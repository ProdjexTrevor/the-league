-- Seed BBQ / yard games + allow user-defined catalog games
-- Run in League Supabase SQL Editor

alter table public.game_catalog
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.game_catalog
  add column if not exists is_system boolean not null default true;

-- Backfill existing rows as system games
update public.game_catalog set is_system = true where is_system is distinct from true;

drop policy if exists "Catalog readable by authenticated" on public.game_catalog;
create policy "Catalog readable by authenticated"
  on public.game_catalog for select
  to authenticated
  using (is_active = true);

drop policy if exists "Users can create custom games" on public.game_catalog;
create policy "Users can create custom games"
  on public.game_catalog for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and is_system = false
  );

drop policy if exists "Users can update own custom games" on public.game_catalog;
create policy "Users can update own custom games"
  on public.game_catalog for update
  to authenticated
  using (created_by = auth.uid() and is_system = false)
  with check (created_by = auth.uid() and is_system = false);

-- System catalog seed (upsert by slug)
insert into public.game_catalog (slug, name, description, scoring_mode, scoring_config, sort_order, is_system)
values
  ('golf', 'Golf', 'Stroke play — lowest total wins', 'lower_wins', '{"unit":"strokes"}'::jsonb, 10, true),
  ('disc-golf', 'Disc Golf', 'Lowest throw count wins', 'lower_wins', '{"unit":"throws"}'::jsonb, 15, true),
  ('cornhole', 'Cornhole', 'Bags on the board — highest score (or race to 21)', 'higher_wins', '{"target":21}'::jsonb, 20, true),
  ('darts', 'Darts', '501 / cricket — track score or placement', 'lower_wins', '{"variants":["501","cricket"]}'::jsonb, 25, true),
  ('card-game', 'Card Game', 'Poker, euchre, spades, etc. — place finishers', 'placement', '{"notes":"1 = winner"}'::jsonb, 30, true),
  ('horseshoes', 'Horseshoes', 'Ringers and leaners — highest points', 'higher_wins', '{}'::jsonb, 40, true),
  ('washers', 'Washers', 'Toss washers into the box — highest score', 'higher_wins', '{}'::jsonb, 45, true),
  ('ladder-ball', 'Ladder Ball', 'Bolas on the ladder — highest points', 'higher_wins', '{}'::jsonb, 50, true),
  ('kanjam', 'KanJam', 'Frisbee into the kan — race to 21', 'higher_wins', '{"target":21}'::jsonb, 55, true),
  ('bocce', 'Bocce', 'Closest to the pallino — track points or placement', 'higher_wins', '{}'::jsonb, 60, true),
  ('spikeball', 'Spikeball', '2v2 rally — win by games', 'head_to_head', '{}'::jsonb, 65, true),
  ('beer-pong', 'Beer Pong', 'Cups remaining / games won', 'higher_wins', '{}'::jsonb, 70, true),
  ('flip-cup', 'Flip Cup', 'Relay races — placement or wins', 'placement', '{}'::jsonb, 75, true),
  ('corn-hole-bags', 'Bags', 'Same spirit as cornhole — highest score', 'higher_wins', '{}'::jsonb, 80, true),
  ('lawn-darts', 'Lawn Darts', 'Points in the ring — highest score', 'higher_wins', '{}'::jsonb, 85, true),
  ('croquet', 'Croquet', 'Wickets completed — highest or placement', 'higher_wins', '{}'::jsonb, 90, true),
  ('badminton', 'Badminton', 'Side vs side', 'head_to_head', '{}'::jsonb, 95, true),
  ('volleyball', 'Volleyball', 'Side vs side', 'head_to_head', '{}'::jsonb, 100, true),
  ('ping-pong', 'Ping Pong', 'Table tennis — games won', 'head_to_head', '{}'::jsonb, 105, true),
  ('custom-user', 'Other (define your own)', 'Placeholder — prefer Create custom game for a named entry', 'custom', '{}'::jsonb, 900, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  scoring_mode = excluded.scoring_mode,
  scoring_config = excluded.scoring_config,
  sort_order = excluded.sort_order,
  is_system = true,
  is_active = true;

-- Soft-hide older generic duplicates we no longer want front-and-center
update public.game_catalog
set is_active = false
where slug in ('march-madness', 'fantasy', 'head-to-head', 'custom')
  and is_system = true;
