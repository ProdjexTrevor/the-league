-- Trips / weekends: group bets and tally who owes whom
-- League: wbwdmxlroniuacibeirg

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  starts_on date,
  ends_on date,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.events
  add column if not exists trip_id uuid references public.trips (id) on delete set null;

create index if not exists events_trip_id_idx on public.events (trip_id);
create index if not exists trips_created_by_idx on public.trips (created_by);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

drop policy if exists "Trip members can view trips" on public.trips;
create policy "Trip members can view trips"
  on public.trips for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trips.id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated can create trips" on public.trips;
create policy "Authenticated can create trips"
  on public.trips for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Creator can update trips" on public.trips;
create policy "Creator can update trips"
  on public.trips for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Trip members can view members" on public.trip_members;
create policy "Trip members can view members"
  on public.trip_members for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and (
          t.created_by = auth.uid()
          or exists (
            select 1 from public.trip_members tm2
            where tm2.trip_id = t.id and tm2.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Creator can add trip members" on public.trip_members;
create policy "Creator can add trip members"
  on public.trip_members for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.created_by = auth.uid()
    )
  );

drop policy if exists "Trip members can add people" on public.trip_members;
create policy "Trip members can add people"
  on public.trip_members for insert to authenticated
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "Creator can remove trip members" on public.trip_members;
create policy "Creator can remove trip members"
  on public.trip_members for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.created_by = auth.uid()
    )
  );

-- Allow event creators / participants to set trip_id if they're on the trip
-- (events update already covered by existing policies in many installs;
--  keep a note that trip_id is nullable and set via app with member check)

grant select, insert, update on public.trips to authenticated;
grant select, insert, delete on public.trip_members to authenticated;
