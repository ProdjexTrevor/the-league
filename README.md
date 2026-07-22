# The League

Friendly group wagers and standings — **Next.js** on **Vercel**, **Supabase** for auth + Postgres.

> Use a **dedicated** Supabase project for The League. Do not reuse an existing app database.

## Stack

- Next.js App Router + Tailwind
- Supabase Auth (email/password)
- Supabase Postgres + RLS
- Deploy target: Vercel

## Database setup (run in order)

In the Supabase SQL Editor for your League project:

1. [`20260721_init.sql`](./supabase/migrations/20260721_init.sql) — if not already applied  
2. [`20260721_fix_create_league.sql`](./supabase/migrations/20260721_fix_create_league.sql) — if needed  
3. [`20260721_competitions_catalog_odds.sql`](./supabase/migrations/20260721_competitions_catalog_odds.sql) — events / odds  
4. [`20260722_catalog_bbq_games.sql`](./supabase/migrations/20260722_catalog_bbq_games.sql) — yard/BBQ catalog + custom games  
5. **[`20260722_venmo_wallet.sql`](./supabase/migrations/20260722_venmo_wallet.sql)** — Venmo username + wallet payouts  

## Wallet / Venmo

- Signup collects **Venmo username**
- After games settle, the wallet shows who you owe
- **Pay on Venmo** opens Venmo with their username (and amount) prefilled
- **Mark paid** clears the IOU in-app (Venmo does not notify us automatically)