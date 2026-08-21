-- Dual win confirmation for bets before wallet IOUs
-- League project only: wbwdmxlroniuacibeirg

create table if not exists public.bet_result_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- user:<uuid> for 1v1, side:<label> for team bets
  winner_key text not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists bet_result_claims_event_idx
  on public.bet_result_claims (event_id);

alter table public.bet_result_claims enable row level security;

drop policy if exists "Participants view bet claims" on public.bet_result_claims;
create policy "Participants view bet claims"
  on public.bet_result_claims for select
  to authenticated
  using (
    exists (
      select 1 from public.event_players ep
      where ep.event_id = bet_result_claims.event_id
        and ep.user_id = auth.uid()
    )
  );

drop policy if exists "Participants claim bet results" on public.bet_result_claims;
create policy "Participants claim bet results"
  on public.bet_result_claims for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.event_players ep
      where ep.event_id = bet_result_claims.event_id
        and ep.user_id = auth.uid()
        and coalesce(ep.invite_status, 'accepted') = 'accepted'
    )
  );

drop policy if exists "Participants update own bet claim" on public.bet_result_claims;
create policy "Participants update own bet claim"
  on public.bet_result_claims for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Participants delete own bet claim" on public.bet_result_claims;
create policy "Participants delete own bet claim"
  on public.bet_result_claims for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.bet_result_claims to authenticated;
