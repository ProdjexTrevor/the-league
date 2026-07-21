-- Fix: allow creators to read a league immediately on INSERT RETURNING
-- (AFTER trigger that adds membership runs after RETURNING is evaluated)

drop policy if exists "Members can view their leagues" on public.leagues;

create policy "Members can view their leagues"
  on public.leagues for select
  to authenticated
  using (
    public.is_league_member(id)
    or created_by = auth.uid()
  );

-- Atomic create helper (preferred path from the app)
create or replace function public.create_league(p_name text, p_description text default null)
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

  -- Ensure profile exists (signup race / confirm-email edge cases)
  insert into public.profiles (id, display_name)
  values (
    auth.uid(),
    coalesce(
      (auth.jwt() -> 'user_metadata' ->> 'display_name'),
      split_part(coalesce(auth.jwt() ->> 'email', 'player'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.leagues (name, description, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), auth.uid())
  returning * into v_league;

  return v_league;
end;
$$;

grant execute on function public.create_league(text, text) to authenticated;
