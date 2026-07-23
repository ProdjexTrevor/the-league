# The League — Mobile (Expo)

iOS/Android app for The League. Shares the same Supabase backend as the web app.

## Run (won’t steal port 8081)

```powershell
cd mobile
npm run start:tunnel
```

Uses **port 8082** so another Expo tunnel can keep running.

## Env

Copy `.env.example` → `.env` with:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Screens

- Auth: login / signup (Venmo username)
- Tabs: Home, Create, Wallet
- Stack: League detail, Event detail

## TestFlight (EAS)

1. `npx eas-cli login`
2. `cd mobile && npx eas init` (fills `extra.eas.projectId`)
3. Confirm Apple bundle id `com.prodjex.theleague` in App Store Connect
4. `npm run eas:build:ios` then submit when the build finishes

Do not commit `.env`.
