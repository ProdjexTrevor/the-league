alter table public.events
  add column if not exists pro_pick jsonb;

comment on column public.events.pro_pick is
  'Structured ESPN pro-game pick for nightly auto-grade/settle recon.';

create index if not exists events_pro_pick_open_idx
  on public.events ((pro_pick->>'espnEventId'))
  where pro_pick is not null and status = 'open';
