-- Secure migration tracking table (rls_disabled_in_public fix)
-- League project only: wbwdmxlroniuacibeirg
-- _league_migrations is agent/ops bookkeeping, never client-facing.

alter table if exists public._league_migrations enable row level security;
alter table if exists public._league_migrations force row level security;

-- No policies for anon/authenticated ⇒ API clients cannot touch this table.
-- service_role and table owner still bypass RLS for apply scripts.

revoke all on table public._league_migrations from anon, authenticated, public;
grant all on table public._league_migrations to postgres, service_role;
