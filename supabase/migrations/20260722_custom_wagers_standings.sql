-- Custom wagers (replace odds UX) + standings wins/losses/money
-- League project only: wbwdmxlroniuacibeirg
-- Idempotent; run in Supabase SQL Editor if CLI not linked

-- Allow custom wager mode (keep odds for any legacy events) --------------------
alter table public.events drop constraint if exists events_wager_mode_check;
alter table public.events
  add constraint events_wager_mode_check
  check (wager_mode in ('none', 'pot', 'odds', 'custom'));

-- create_event: accept custom -------------------------------------------------
create or replace function public.create_event(
  p_kind text,
  p_title text,
  p_catalog_id uuid,
  p_league_id uuid default null,
  p_entry_fee numeric default 0,
  p_wager_mode text default 'pot',
  p_stake numeric default 0,
  p_notes text default null,
  p_format text default null,
  p_bracket_size int default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind not in ('game', 'tournament') then
    raise exception 'kind must be game or tournament';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  if p_wager_mode not in ('none', 'pot', 'odds', 'custom') then
    raise exception 'Invalid wager mode';
  end if;

  if p_league_id is not null and not public.is_league_member(p_league_id) then
    raise exception 'Not a league member';
  end if;

  insert into public.profiles (id, display_name)
  values (
    auth.uid(),
    coalesce(
      (auth.jwt() -> 'user_metadata' ->> 'display_name'),
      split_part(coalesce(auth.jwt() ->> 'email', 'player'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.events (
    kind, league_id, catalog_id, title, entry_fee_units, wager_mode,
    default_stake_units, notes, format, bracket_size, created_by, status
  )
  values (
    p_kind,
    p_league_id,
    p_catalog_id,
    trim(p_title),
    greatest(coalesce(p_entry_fee, 0), 0),
    p_wager_mode,
    greatest(coalesce(p_stake, 0), 0),
    nullif(trim(p_notes), ''),
    case when p_kind = 'tournament' then coalesce(p_format, 'single_elim') else null end,
    case when p_kind = 'tournament' then p_bracket_size else null end,
    auth.uid(),
    'open'
  )
  returning * into v_event;

  insert into public.event_players (event_id, user_id, entry_paid, units_paid)
  values (
    v_event.id,
    auth.uid(),
    v_event.entry_fee_units > 0,
    v_event.entry_fee_units
  );

  return v_event;
end;
$$;

grant execute on function public.create_event(
  text, text, uuid, uuid, numeric, text, numeric, text, text, int
) to authenticated;

-- Standings: wins, losses, money won/lost/net ---------------------------------
drop view if exists public.league_standings;

create view public.league_standings
with (security_invoker = true)
as
with legacy as (
  select
    g.league_id,
    gp.user_id,
    count(*) filter (where g.status = 'completed') as games_played,
    count(*) filter (where g.status = 'completed' and gp.placement = 1) as wins,
    count(*) filter (
      where g.status = 'completed'
        and gp.placement is not null
        and gp.placement <> 1
    ) as losses,
    coalesce(sum(gp.units_delta) filter (where g.status = 'completed'), 0) as net_units,
    coalesce(
      sum(gp.units_delta) filter (where g.status = 'completed' and gp.units_delta > 0),
      0
    ) as money_won,
    coalesce(
      sum(abs(gp.units_delta)) filter (where g.status = 'completed' and gp.units_delta < 0),
      0
    ) as money_lost
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  where g.league_id is not null
  group by g.league_id, gp.user_id
),
modern as (
  select
    e.league_id,
    ep.user_id,
    count(*) filter (where e.status = 'completed') as games_played,
    count(*) filter (
      where e.status = 'completed'
        and (ep.placement = 1 or ep.outcome = 'win')
    ) as wins,
    count(*) filter (
      where e.status = 'completed'
        and coalesce(ep.outcome, '') <> 'draw'
        and not (ep.placement = 1 or ep.outcome = 'win')
    ) as losses,
    coalesce(sum(ep.units_delta) filter (where e.status = 'completed'), 0) as net_units,
    coalesce(
      sum(ep.units_delta) filter (where e.status = 'completed' and ep.units_delta > 0),
      0
    ) as money_won,
    coalesce(
      sum(abs(ep.units_delta)) filter (where e.status = 'completed' and ep.units_delta < 0),
      0
    ) as money_lost
  from public.event_players ep
  join public.events e on e.id = ep.event_id
  where e.league_id is not null
  group by e.league_id, ep.user_id
),
combined as (
  select * from legacy
  union all
  select * from modern
)
select
  league_id,
  user_id,
  sum(games_played)::bigint as games_played,
  sum(wins)::bigint as wins,
  sum(losses)::bigint as losses,
  sum(net_units) as net_units,
  sum(money_won) as money_won,
  sum(money_lost) as money_lost
from combined
group by league_id, user_id;

grant select on public.league_standings to authenticated;
