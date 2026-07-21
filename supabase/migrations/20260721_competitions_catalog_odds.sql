-- Competitions, game catalog, and fractional odds
-- Run in Supabase SQL Editor after init (+ fix_create_league if needed)

-- Leagues: optional season buy-in ------------------------------------------------
alter table public.leagues
  add column if not exists default_entry_fee_units numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leagues_default_entry_fee_units_check'
  ) then
    alter table public.leagues
      add constraint leagues_default_entry_fee_units_check
      check (default_entry_fee_units >= 0);
  end if;
end $$;

drop function if exists public.create_league(text, text);
drop function if exists public.create_league(text, text, numeric);

create or replace function public.create_league(
  p_name text,
  p_description text default null,
  p_entry_fee numeric default 0
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.leagues;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'League name is required';
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

  insert into public.leagues (name, description, created_by, default_entry_fee_units)
  values (
    trim(p_name),
    nullif(trim(p_description), ''),
    auth.uid(),
    greatest(coalesce(p_entry_fee, 0), 0)
  )
  returning * into v_league;

  return v_league;
end;
$$;

grant execute on function public.create_league(text, text, numeric) to authenticated;

-- Game catalog -------------------------------------------------------------------
create table if not exists public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  scoring_mode text not null default 'placement'
    check (scoring_mode in (
      'higher_wins', 'lower_wins', 'placement', 'head_to_head', 'custom'
    )),
  scoring_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.game_catalog enable row level security;

drop policy if exists "Catalog readable by authenticated" on public.game_catalog;
create policy "Catalog readable by authenticated"
  on public.game_catalog for select
  to authenticated
  using (is_active = true);

insert into public.game_catalog (slug, name, description, scoring_mode, scoring_config, sort_order)
values
  ('poker', 'Poker', 'Texas Hold''em / cash or tournament night', 'placement', '{"notes":"Lower placement wins"}'::jsonb, 10),
  ('cornhole', 'Cornhole', 'Bags — first to win or highest score', 'higher_wins', '{}'::jsonb, 20),
  ('golf', 'Golf', 'Lowest stroke total wins', 'lower_wins', '{}'::jsonb, 30),
  ('march-madness', 'March Madness', 'Bracket challenge', 'higher_wins', '{}'::jsonb, 40),
  ('fantasy', 'Fantasy', 'Season-long fantasy scores', 'higher_wins', '{}'::jsonb, 50),
  ('head-to-head', 'Head to Head', 'Two-sided matchup', 'head_to_head', '{"outcomes":["win","loss","draw"]}'::jsonb, 60),
  ('custom', 'Custom', 'Anything else you play for bragging rights', 'custom', '{}'::jsonb, 90)
on conflict (slug) do nothing;

-- Events -------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('game', 'tournament')),
  league_id uuid references public.leagues (id) on delete cascade,
  catalog_id uuid not null references public.game_catalog (id),
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  notes text,
  entry_fee_units numeric(12, 2) not null default 0 check (entry_fee_units >= 0),
  wager_mode text not null default 'pot'
    check (wager_mode in ('none', 'pot', 'odds')),
  default_stake_units numeric(12, 2) not null default 0 check (default_stake_units >= 0),
  bracket_size int,
  format text check (format is null or format in ('single_elim', 'round_robin', 'custom')),
  created_by uuid not null references public.profiles (id),
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_league_id_idx on public.events (league_id);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists events_catalog_id_idx on public.events (catalog_id);

alter table public.events enable row level security;

-- Event players (before can_access_event) ----------------------------------------
create table if not exists public.event_players (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seed int,
  side_label text,
  score numeric(12, 2),
  placement int check (placement is null or placement >= 1),
  outcome text check (outcome is null or outcome in ('win', 'loss', 'draw')),
  entry_paid boolean not null default false,
  units_paid numeric(12, 2) not null default 0,
  units_delta numeric(12, 2) not null default 0,
  primary key (event_id, user_id)
);

create index if not exists event_players_user_id_idx on public.event_players (user_id);

alter table public.event_players enable row level security;

create or replace function public.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        e.created_by = auth.uid()
        or (e.league_id is not null and public.is_league_member(e.league_id))
        or exists (
          select 1 from public.event_players ep
          where ep.event_id = e.id and ep.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "Access events" on public.events;
create policy "Access events"
  on public.events for select
  to authenticated
  using (
    created_by = auth.uid()
    or (league_id is not null and public.is_league_member(league_id))
    or exists (
      select 1 from public.event_players ep
      where ep.event_id = id and ep.user_id = auth.uid()
    )
  );

drop policy if exists "Create events" on public.events;
create policy "Create events"
  on public.events for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (
      league_id is null
      or public.is_league_member(league_id)
    )
  );

drop policy if exists "Update events" on public.events;
create policy "Update events"
  on public.events for update
  to authenticated
  using (public.can_access_event(id))
  with check (public.can_access_event(id));

drop policy if exists "Delete events" on public.events;
create policy "Delete events"
  on public.events for delete
  to authenticated
  using (
    created_by = auth.uid()
    or (league_id is not null and public.is_league_owner(league_id))
  );

drop policy if exists "View event players" on public.event_players;
create policy "View event players"
  on public.event_players for select
  to authenticated
  using (public.can_access_event(event_id));

drop policy if exists "Insert event players" on public.event_players;
create policy "Insert event players"
  on public.event_players for insert
  to authenticated
  with check (public.can_access_event(event_id));

drop policy if exists "Update event players" on public.event_players;
create policy "Update event players"
  on public.event_players for update
  to authenticated
  using (public.can_access_event(event_id));

drop policy if exists "Delete event players" on public.event_players;
create policy "Delete event players"
  on public.event_players for delete
  to authenticated
  using (public.can_access_event(event_id));

-- Wager lines --------------------------------------------------------------------
create table if not exists public.wager_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid references public.profiles (id) on delete cascade,
  side_label text,
  odds_num int not null check (odds_num > 0),
  odds_den int not null check (odds_den > 0),
  stake_units numeric(12, 2) not null default 0 check (stake_units >= 0),
  created_at timestamptz not null default now(),
  check (player_id is not null or side_label is not null)
);

create index if not exists wager_lines_event_id_idx on public.wager_lines (event_id);

alter table public.wager_lines enable row level security;

drop policy if exists "View wager lines" on public.wager_lines;
create policy "View wager lines"
  on public.wager_lines for select
  to authenticated
  using (public.can_access_event(event_id));

drop policy if exists "Manage wager lines" on public.wager_lines;
create policy "Manage wager lines"
  on public.wager_lines for insert
  to authenticated
  with check (public.can_access_event(event_id));

drop policy if exists "Update wager lines" on public.wager_lines;
create policy "Update wager lines"
  on public.wager_lines for update
  to authenticated
  using (public.can_access_event(event_id));

drop policy if exists "Delete wager lines" on public.wager_lines;
create policy "Delete wager lines"
  on public.wager_lines for delete
  to authenticated
  using (public.can_access_event(event_id));

-- create_event RPC ---------------------------------------------------------------
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

  if p_wager_mode not in ('none', 'pot', 'odds') then
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

-- Standings: legacy games + events -----------------------------------------------
create or replace view public.league_standings
with (security_invoker = true)
as
with legacy as (
  select
    g.league_id,
    gp.user_id,
    count(*) filter (where g.status = 'completed') as games_played,
    count(*) filter (where g.status = 'completed' and gp.placement = 1) as wins,
    coalesce(sum(gp.units_delta) filter (where g.status = 'completed'), 0) as net_units
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
    coalesce(sum(ep.units_delta) filter (where e.status = 'completed'), 0) as net_units
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
  sum(net_units) as net_units
from combined
group by league_id, user_id;

grant select on public.league_standings to authenticated;
