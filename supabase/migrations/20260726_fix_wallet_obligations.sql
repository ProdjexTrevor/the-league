-- Fix wallet IOUs after settle (League: wbwdmxlroniuacibeirg)
-- - Explicit grants so authenticated clients can read/update obligations
-- - Harden record_event_obligations (accepted players only, skip $0 rows)
-- - Backfill IOUs for completed events that already have money deltas
-- - repair_my_wallet_obligations() so opening Wallet can heal missing rows

grant select, update on table public.wallet_obligations to authenticated;
grant all on table public.wallet_obligations to service_role;

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
  v_amount numeric;
begin
  -- Clear prior open rows for this event (re-settle / repair safe)
  delete from public.wallet_obligations
  where event_id = p_event_id and status = 'open';

  select coalesce(sum(units_delta), 0) into total_won
  from public.event_players
  where event_id = p_event_id
    and coalesce(invite_status, 'accepted') = 'accepted'
    and units_delta > 0;

  select coalesce(sum(-units_delta), 0) into total_lost
  from public.event_players
  where event_id = p_event_id
    and coalesce(invite_status, 'accepted') = 'accepted'
    and units_delta < 0;

  if total_won <= 0 or total_lost <= 0 then
    return;
  end if;

  for r in
    select user_id, -units_delta as lost
    from public.event_players
    where event_id = p_event_id
      and coalesce(invite_status, 'accepted') = 'accepted'
      and units_delta < 0
  loop
    for w in
      select user_id, units_delta as won
      from public.event_players
      where event_id = p_event_id
        and coalesce(invite_status, 'accepted') = 'accepted'
        and units_delta > 0
    loop
      v_amount := round((r.lost * (w.won / total_won))::numeric, 2);
      if v_amount > 0 then
        insert into public.wallet_obligations (
          event_id, from_user_id, to_user_id, amount, note
        )
        values (
          p_event_id,
          r.user_id,
          w.user_id,
          v_amount,
          'Event settlement'
        );
      end if;
    end loop;
  end loop;
end;
$$;

grant execute on function public.record_event_obligations(uuid) to authenticated;

-- Rebuild open IOUs only for completed events that have money deltas
-- but zero wallet rows yet (avoids undoing Mark paid).
create or replace function public.repair_my_wallet_obligations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  for e in
    select ev.id
    from public.events ev
    join public.event_players me
      on me.event_id = ev.id and me.user_id = auth.uid()
    where ev.status = 'completed'
      and coalesce(me.invite_status, 'accepted') = 'accepted'
      and exists (
        select 1
        from public.event_players ep
        where ep.event_id = ev.id
          and coalesce(ep.invite_status, 'accepted') = 'accepted'
          and ep.units_delta <> 0
      )
      and not exists (
        select 1
        from public.wallet_obligations wo
        where wo.event_id = ev.id
      )
  loop
    perform public.record_event_obligations(e.id);
    n := n + 1;
  end loop;

  return n;
end;
$$;

grant execute on function public.repair_my_wallet_obligations() to authenticated;

-- One-shot backfill for completed money events that never got wallet rows
do $$
declare
  e record;
begin
  for e in
    select ev.id
    from public.events ev
    where ev.status = 'completed'
      and exists (
        select 1
        from public.event_players ep
        where ep.event_id = ev.id
          and coalesce(ep.invite_status, 'accepted') = 'accepted'
          and ep.units_delta <> 0
      )
      and not exists (
        select 1
        from public.wallet_obligations wo
        where wo.event_id = ev.id
      )
  loop
    perform public.record_event_obligations(e.id);
  end loop;
end $$;
