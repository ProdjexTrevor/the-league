-- Game within the game (e.g. golf club draft) on events
alter table public.events
  add column if not exists mini_game text;

alter table public.events
  add column if not exists mini_game_state jsonb;

comment on column public.events.mini_game is
  'Optional mini-game key, e.g. golf_club_draft';
comment on column public.events.mini_game_state is
  'JSON state for the mini-game (draft picks, remaining clubs, etc.)';
