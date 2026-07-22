-- Venmo usernames + wallet payout obligations
-- Run after competitions catalog migrations

alter table public.profiles
  add column if not exists venmo_username text;

create index if not exists profiles_venmo_username_idx
  on public.profiles (venmo_username)
  where venmo_username is not null;

-- Update signup trigger to store Venmo from user metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, venmo_username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    nullif(
      lower(regexp_replace(
        coalesce(new.raw_user_meta_data->>'venmo_username', ''),
        '^@+',
        ''
      )),
      ''
    )
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    venmo_username = coalesce(excluded.venmo_username, public.profiles.venmo_username);
  return new;
end;
$$;

-- Who owes whom after settled events
create table if not exists public.wallet_obligations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'open' check (status in ('open', 'paid')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (from_user_id <> to_user_id)
);

create index if not exists wallet_obligations_from_idx
  on public.wallet_obligations (from_user_id, status);
create index if not exists wallet_obligations_to_idx
  on public.wallet_obligations (to_user_id, status);
create index if not exists wallet_obligations_event_idx
  on public.wallet_obligations (event_id);

alter table public.wallet_obligations enable row level security;

drop policy if exists "View own obligations" on public.wallet_obligations;
create policy "View own obligations"
  on public.wallet_obligations for select
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "Payer can mark paid" on public.wallet_obligations;
create policy "Payer can mark paid"
  on public.wallet_obligations for update
  to authenticated
  using (from_user_id = auth.uid())
  with check (from_user_id = auth.uid());

-- Inserts happen via security definer RPC after settle
create or replace function public.record_event_obligations(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  w record;
  total_won numeric;
  total_lost numeric;
begin
  -- Clear prior open rows for this event (re-settle safe)
  delete from public.wallet_obligations
  where event_id = p_event_id and status = 'open';

  select coalesce(sum(units_delta), 0) into total_won
  from public.event_players
  where event_id = p_event_id and units_delta > 0;

  select coalesce(sum(-units_delta), 0) into total_lost
  from public.event_players
  where event_id = p_event_id and units_delta < 0;

  if total_won <= 0 or total_lost <= 0 then
    return;
  end if;

  for r in
    select user_id, -units_delta as lost
    from public.event_players
    where event_id = p_event_id and units_delta < 0
  loop
    for w in
      select user_id, units_delta as won
      from public.event_players
      where event_id = p_event_id and units_delta > 0
    loop
      insert into public.wallet_obligations (
        event_id, from_user_id, to_user_id, amount, note
      )
      values (
        p_event_id,
        r.user_id,
        w.user_id,
        round((r.lost * (w.won / total_won))::numeric, 2),
        'Event settlement'
      );
    end loop;
  end loop;
end;
$$;

grant execute on function public.record_event_obligations(uuid) to authenticated;

-- Aggregated open balances you owe others
create or replace view public.wallet_balances_owed
with (security_invoker = true)
as
select
  from_user_id as user_id,
  to_user_id as counterparty_id,
  sum(amount) as amount_owed
from public.wallet_obligations
where status = 'open'
group by from_user_id, to_user_id;

grant select on public.wallet_balances_owed to authenticated;

-- Aggregated open balances others owe you
create or replace view public.wallet_balances_due
with (security_invoker = true)
as
select
  to_user_id as user_id,
  from_user_id as counterparty_id,
  sum(amount) as amount_due
from public.wallet_obligations
where status = 'open'
group by to_user_id, from_user_id;

grant select on public.wallet_balances_due to authenticated;
