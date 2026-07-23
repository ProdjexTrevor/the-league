-- Bets + player invites (accept required)
-- League project only: wbwdmxlroniuacibeirg
-- Idempotent; run in Supabase SQL Editor if CLI not linked

-- Catalog: proposition bet ----------------------------------------------------
insert into public.game_catalog (
  slug, name, description, scoring_mode, scoring_config, sort_order, is_system
)
values (
  'proposition',
  'Proposition bet',
  'Describe the bet; each side puts up their own stake. Settle as win / loss / draw.',
  'head_to_head',
  '{"outcomes":["win","loss","draw"]}'::jsonb,
  5,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  scoring_mode = excluded.scoring_mode,
  is_active = true,
  is_system = true;

-- events.kind: allow bet ------------------------------------------------------
alter table public.events drop constraint if exists events_kind_check;
alter table public.events
  add constraint events_kind_check
  check (kind in ('game', 'tournament', 'bet'));

-- event_players: invite status ------------------------------------------------
alter table public.event_players
  add column if not exists invite_status text;

update public.event_players
set invite_status = 'accepted'
where invite_status is null;

alter table public.event_players
  alter column invite_status set default 'pending';

alter table public.event_players
  alter column invite_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_players_invite_status_check'
  ) then
    alter table public.event_players
      add constraint event_players_invite_status_check
      check (invite_status in ('pending', 'accepted', 'declined'));
  end if;
end $$;

create index if not exists event_players_invite_status_idx
  on public.event_players (user_id, invite_status);

-- create_event: allow bet; creator accepted -----------------------------------
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

  if p_kind not in ('game', 'tournament', 'bet') then
    raise exception 'kind must be game, tournament, or bet';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  if p_kind = 'bet' and (p_notes is null or length(trim(p_notes)) = 0) then
    raise exception 'Bet description is required';
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

  insert into public.event_players (
    event_id, user_id, entry_paid, units_paid, invite_status
  )
  values (
    v_event.id,
    auth.uid(),
    v_event.entry_fee_units > 0,
    v_event.entry_fee_units,
    'accepted'
  );

  return v_event;
end;
$$;

grant execute on function public.create_event(
  text, text, uuid, uuid, numeric, text, numeric, text, text, int
) to authenticated;

-- Accept invite (optionally set own wager for custom bets) --------------------
create or replace function public.accept_event_invite(
  p_event_id uuid,
  p_wager_units numeric default null
)
returns public.event_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_row public.event_players;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;

  if v_event.status in ('completed', 'cancelled') then
    raise exception 'Event is closed';
  end if;

  select * into v_row
  from public.event_players
  where event_id = p_event_id and user_id = auth.uid();

  if not found then
    raise exception 'No invite found';
  end if;

  if v_row.invite_status = 'accepted' then
    return v_row;
  end if;

  if v_row.invite_status = 'declined' then
    raise exception 'Invite was declined';
  end if;

  if v_event.wager_mode = 'custom' and p_wager_units is not null then
    if not (p_wager_units > 0) then
      raise exception 'Enter how much money you are wagering';
    end if;

    delete from public.wager_lines
    where event_id = p_event_id and player_id = auth.uid();

    insert into public.wager_lines (
      event_id, player_id, odds_num, odds_den, stake_units
    )
    values (p_event_id, auth.uid(), 1, 1, p_wager_units);
  elsif v_event.kind = 'bet' and v_event.wager_mode = 'custom' then
    if not exists (
      select 1 from public.wager_lines
      where event_id = p_event_id and player_id = auth.uid() and stake_units > 0
    ) then
      if p_wager_units is null or not (p_wager_units > 0) then
        raise exception 'Enter how much money you are wagering';
      end if;
    end if;
  end if;

  update public.event_players
  set invite_status = 'accepted'
  where event_id = p_event_id and user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.accept_event_invite(uuid, numeric) to authenticated;

create or replace function public.decline_event_invite(p_event_id uuid)
returns public.event_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_players;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.event_players
  set invite_status = 'declined'
  where event_id = p_event_id
    and user_id = auth.uid()
    and invite_status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'No pending invite found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.decline_event_invite(uuid) to authenticated;
