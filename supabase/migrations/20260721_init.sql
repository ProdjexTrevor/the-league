-- The League — core schema (run in a dedicated Supabase project)
-- Auth: Supabase Auth (email/password + magic link)

create extension if not exists "pgcrypto";

-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leagues ----------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leagues_invite_code_idx on public.leagues (invite_code);
create index leagues_created_by_idx on public.leagues (created_by);

alter table public.leagues enable row level security;

-- League members ---------------------------------------------------------
create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index league_members_user_id_idx on public.league_members (user_id);

alter table public.league_members enable row level security;

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_owner(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create policy "Members can view their leagues"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id));

create policy "Anyone authenticated can create a league"
  on public.leagues for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Owners can update league"
  on public.leagues for update
  to authenticated
  using (public.is_league_owner(id))
  with check (public.is_league_owner(id));

create policy "Owners can delete league"
  on public.leagues for delete
  to authenticated
  using (public.is_league_owner(id));

-- Auto-add creator as owner
create or replace function public.handle_new_league()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_members (league_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_league_created
  after insert on public.leagues
  for each row execute function public.handle_new_league();

-- Join by invite code (avoids exposing all leagues via RLS)
create or replace function public.join_league_by_code(p_code text)
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

  select * into v_league
  from public.leagues
  where invite_code = upper(trim(p_code));

  if v_league.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, auth.uid(), 'member')
  on conflict do nothing;

  return v_league;
end;
$$;

grant execute on function public.join_league_by_code(text) to authenticated;

create policy "Members can see league roster"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "Users can join a league (self insert)"
  on public.league_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Owners can remove members"
  on public.league_members for delete
  to authenticated
  using (
    public.is_league_owner(league_id)
    or user_id = auth.uid()
  );

-- Game types -------------------------------------------------------------
create table public.game_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.game_types enable row level security;

create policy "Game types readable by authenticated"
  on public.game_types for select
  to authenticated
  using (true);

insert into public.game_types (name, description) values
  ('Poker', 'Texas Hold''em / cash or tournament night'),
  ('Cornhole', 'Bags — first to win or highest score'),
  ('Golf', 'Lowest stroke total wins'),
  ('March Madness', 'Bracket challenge'),
  ('Fantasy', 'Season-long fantasy scores'),
  ('Custom', 'Anything else you play for bragging rights');

-- Games ------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  game_type_id uuid not null references public.game_types (id),
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  wager_units numeric(12, 2) not null default 0
    check (wager_units >= 0),
  notes text,
  created_by uuid not null references public.profiles (id),
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_league_id_idx on public.games (league_id);

alter table public.games enable row level security;

create policy "Members can view league games"
  on public.games for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "Members can create games"
  on public.games for insert
  to authenticated
  with check (
    public.is_league_member(league_id)
    and auth.uid() = created_by
  );

create policy "Members can update games"
  on public.games for update
  to authenticated
  using (public.is_league_member(league_id))
  with check (public.is_league_member(league_id));

create policy "Creator or owner can delete games"
  on public.games for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_league_owner(league_id)
  );

-- Game players -----------------------------------------------------------
create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  placement int check (placement is null or placement >= 1),
  score numeric(12, 2),
  units_delta numeric(12, 2) not null default 0,
  primary key (game_id, user_id)
);

create index game_players_user_id_idx on public.game_players (user_id);

alter table public.game_players enable row level security;

create policy "Members can view game players"
  on public.game_players for select
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and public.is_league_member(g.league_id)
    )
  );

create policy "Members can manage game players"
  on public.game_players for insert
  to authenticated
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id and public.is_league_member(g.league_id)
    )
  );

create policy "Members can update game players"
  on public.game_players for update
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and public.is_league_member(g.league_id)
    )
  );

create policy "Members can remove game players"
  on public.game_players for delete
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and public.is_league_member(g.league_id)
    )
  );

-- Standings view ---------------------------------------------------------
create or replace view public.league_standings
with (security_invoker = true)
as
select
  g.league_id,
  gp.user_id,
  count(*) filter (where g.status = 'completed') as games_played,
  count(*) filter (where g.status = 'completed' and gp.placement = 1) as wins,
  coalesce(sum(gp.units_delta) filter (where g.status = 'completed'), 0) as net_units
from public.game_players gp
join public.games g on g.id = gp.game_id
group by g.league_id, gp.user_id;

grant select on public.league_standings to authenticated;
