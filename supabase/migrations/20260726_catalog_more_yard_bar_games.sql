-- Expand system catalog with more yard + bar games
-- League project only: wbwdmxlroniuacibeirg
-- Idempotent; run in Supabase SQL Editor if CLI not linked

insert into public.game_catalog (slug, name, description, scoring_mode, scoring_config, sort_order, is_system)
values
  -- Yard / backyard
  ('kubb', 'Kubb', 'Knock down kubbs then the king — games won or placement', 'head_to_head', '{}'::jsonb, 110, true),
  ('molkky', 'Mölkky', 'Knock numbered pins — race to 50 (bust rules optional)', 'higher_wins', '{"target":50}'::jsonb, 115, true),
  ('pickleball', 'Pickleball', 'Side vs side — games or sets won', 'head_to_head', '{}'::jsonb, 120, true),
  ('ring-toss', 'Ring Toss', 'Rings on the pegs — highest score', 'higher_wins', '{}'::jsonb, 125, true),
  ('giant-jenga', 'Giant Jenga', 'Last move before collapse wins — or placement by rounds', 'placement', '{}'::jsonb, 130, true),
  ('axe-throwing', 'Axe Throwing', 'Bullseye scoring — highest points', 'higher_wins', '{}'::jsonb, 135, true),
  ('deck-shuffleboard', 'Deck Shuffleboard', 'Discs closest to the end — highest score', 'higher_wins', '{}'::jsonb, 140, true),
  ('wiffle-ball', 'Wiffle Ball', 'Runs scored — highest wins', 'higher_wins', '{}'::jsonb, 145, true),
  ('kickball', 'Kickball', 'Runs scored — highest wins', 'higher_wins', '{}'::jsonb, 150, true),
  ('lawn-bowling', 'Lawn Bowling', 'Closest to the jack — track points', 'higher_wins', '{}'::jsonb, 155, true),
  ('tug-of-war', 'Tug of War', 'Best of pulls — side vs side', 'head_to_head', '{}'::jsonb, 160, true),
  ('archery', 'Archery', 'Closest to center / total points', 'higher_wins', '{}'::jsonb, 165, true),
  ('softball', 'Softball', 'Runs scored — highest wins', 'higher_wins', '{}'::jsonb, 170, true),
  ('capture-the-flag', 'Capture the Flag', 'Flags captured or team wins', 'head_to_head', '{}'::jsonb, 175, true),
  ('frisbee', 'Ultimate Frisbee', 'Points scored — highest or side vs side', 'higher_wins', '{}'::jsonb, 180, true),
  ('bean-bag-toss', 'Bean Bag Toss', 'Bags on the board — highest score', 'higher_wins', '{}'::jsonb, 185, true),
  ('quoits', 'Quoits', 'Rings closest to the hob — highest points', 'higher_wins', '{}'::jsonb, 190, true),
  ('petanque', 'Pétanque', 'Boules closest to the cochonnet — highest score', 'higher_wins', '{}'::jsonb, 195, true),

  -- Bar / pub / table
  ('pool', 'Pool / Billiards', 'Games won — 8-ball, 9-ball, etc.', 'head_to_head', '{"variants":["8-ball","9-ball"]}'::jsonb, 200, true),
  ('foosball', 'Foosball', 'Table soccer — games won', 'head_to_head', '{}'::jsonb, 205, true),
  ('table-shuffleboard', 'Table Shuffleboard', 'Weights closest to the end — highest score', 'higher_wins', '{}'::jsonb, 210, true),
  ('air-hockey', 'Air Hockey', 'Goals scored — highest or race to N', 'higher_wins', '{}'::jsonb, 215, true),
  ('skee-ball', 'Skee-Ball', 'Highest ticket / point total', 'higher_wins', '{}'::jsonb, 220, true),
  ('bowling', 'Bowling', 'Pin total — highest score', 'higher_wins', '{"frames":10}'::jsonb, 225, true),
  ('pinball', 'Pinball', 'Highest score on the machine', 'higher_wins', '{}'::jsonb, 230, true),
  ('arcade-basketball', 'Arcade Basketball', 'Baskets in time — highest score', 'higher_wins', '{}'::jsonb, 235, true),
  ('quarters', 'Quarters', 'Bounce landings / elimination — placement or wins', 'placement', '{}'::jsonb, 240, true),
  ('beer-die', 'Beer Die / Snappa', 'Points on the table — highest or games won', 'higher_wins', '{}'::jsonb, 245, true),
  ('boat-race', 'Boat Race', 'Chug relay — fastest team or placement', 'placement', '{}'::jsonb, 250, true),
  ('kings-cup', 'Kings Cup', 'Drinking card game — last standing or placement', 'placement', '{}'::jsonb, 255, true),
  ('connect-four', 'Connect Four', 'Best of games', 'head_to_head', '{}'::jsonb, 260, true),
  ('jenga', 'Jenga', 'Last successful pull wins', 'placement', '{}'::jsonb, 265, true),
  ('trivia', 'Trivia', 'Correct answers — highest score', 'higher_wins', '{}'::jsonb, 270, true),
  ('chess', 'Chess', 'Games won', 'head_to_head', '{}'::jsonb, 275, true),
  ('checkers', 'Checkers', 'Games won', 'head_to_head', '{}'::jsonb, 280, true),
  ('backgammon', 'Backgammon', 'Games / points won', 'higher_wins', '{}'::jsonb, 285, true),
  ('cribbage', 'Cribbage', 'Race to 121', 'higher_wins', '{"target":121}'::jsonb, 290, true),
  ('dominoes', 'Dominoes', 'Points or games won', 'higher_wins', '{}'::jsonb, 295, true),
  ('uno', 'Uno', 'Rounds won or placement', 'placement', '{}'::jsonb, 300, true),
  ('blackjack', 'Blackjack', 'Chip stack / hands won — house rules', 'higher_wins', '{}'::jsonb, 305, true),
  ('liars-dice', 'Liar''s Dice', 'Last player with dice wins', 'placement', '{}'::jsonb, 310, true),
  ('yahtzee', 'Yahtzee', 'Highest scorecard total', 'higher_wins', '{}'::jsonb, 315, true),
  ('arm-wrestling', 'Arm Wrestling', 'Best of pulls', 'head_to_head', '{}'::jsonb, 320, true),
  ('rock-paper-scissors', 'Rock Paper Scissors', 'Best of N', 'head_to_head', '{}'::jsonb, 325, true),
  ('thumb-war', 'Thumb War', 'Best of pulls', 'head_to_head', '{}'::jsonb, 330, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  scoring_mode = excluded.scoring_mode,
  scoring_config = excluded.scoring_config,
  sort_order = excluded.sort_order,
  is_system = true,
  is_active = true;
