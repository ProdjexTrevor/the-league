# The League — agent guide

## Pipeline (mandatory)

Every feature/fix: **Plan → Build → Test → Push + verify Vercel → Mobile/TestFlight**.

Details: `.cursor/rules/workflow.mdc`, `.cursor/rules/deploy-verify.mdc`, `.cursor/rules/supabase-migrations.mdc`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase Auth + Postgres (project ref `wbwdmxlroniuacibeirg`)
- Deploy: Vercel (`the-league-ivory.vercel.app`)
- Slack local agent: `tools/slack-agent-bridge` (`build:` / `status:`)

## Next.js note

This Next version may differ from training data — check `node_modules/next/dist/docs/` when unsure.

## Money

Units / Venmo deep links only. No payment processor APIs.

## Mobile / TestFlight

No Expo/native app in-repo yet. User-facing work must either start the mobile track or explicitly report TestFlight blocked.
