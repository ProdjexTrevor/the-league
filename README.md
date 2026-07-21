# The League

Friendly group wagers and standings — **Next.js** on **Vercel**, **Supabase** for auth + Postgres.

> Use a **dedicated** Supabase project for The League. Do not reuse an existing app database (e.g. Grind Pass).

## Stack

- Next.js App Router + Tailwind
- Supabase Auth (email/password)
- Supabase Postgres + RLS
- Deploy target: Vercel

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Open **SQL Editor** → paste and run  
   [`supabase/migrations/20260721_init.sql`](./supabase/migrations/20260721_init.sql)
3. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000` (add your Vercel URL later)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`
4. **Project Settings → API** — copy Project URL and `anon` key

## 2. Local env

```bash
cd the-league
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 3. Deploy on Vercel

1. Push this repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → import the repo (root: `the-league` if monorepo)
3. Add the same env vars as `.env.local`
4. Deploy
5. In Supabase Auth URL settings, add your `*.vercel.app` (and custom domain) Site URL + `/auth/callback`

## What you can do

- Sign up / log in
- Create a league (get an invite code)
- Join a league with a code
- Create games with a unit wager
- Add players, set placements, settle the pot
- League standings (wins + net units)

## Project layout

```
src/app/           # pages + server actions
src/lib/supabase/  # browser / server / middleware clients
supabase/migrations # SQL schema + RLS
```
