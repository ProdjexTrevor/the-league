# The League

Friendly group wagers and standings — **Next.js** on **Vercel**, **Supabase** for auth + Postgres.

> Use a **dedicated** Supabase project for The League. Do not reuse an existing app database.

## Stack

- Next.js App Router + Tailwind
- Supabase Auth (email/password)
- Supabase Postgres + RLS
- Deploy target: Vercel

## Database setup (run in order)

In the Supabase SQL Editor for project `wbwdmxlroniuacibeirg` (or your League project):

1. [`supabase/migrations/20260721_init.sql`](./supabase/migrations/20260721_init.sql) — if not already applied  
2. [`supabase/migrations/20260721_fix_create_league.sql`](./supabase/migrations/20260721_fix_create_league.sql) — if create-league was broken  
3. **[`supabase/migrations/20260721_competitions_catalog_odds.sql`](./supabase/migrations/20260721_competitions_catalog_odds.sql)** — catalog, events, odds, entry fees  

Then Auth → URL config: Site URL + `/auth/callback` for localhost and Vercel.

## Local env

```bash
cd the-league
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

## What you can do

- Create a **league** (invite code, optional season entry fee)
- Create a **game** or **tournament** (standalone or in a league)
- Pick from the **game catalog** (scoring modes: higher/lower/placement/H2H/custom)
- Set **entry fee**, wager mode **none / pot / odds**
- Write fractional odds (**2 to 1**, etc.) and settle
- View catalog at `/catalog` — send more games later to seed

## Vercel

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`  
Production: https://the-league-ivory.vercel.app
