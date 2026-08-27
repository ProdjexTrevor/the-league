# The League — Mobile (Expo SDK 54)

iOS/Android app for The League. Same Supabase backend as the web app.

## UI approach

Built with **[React Native Paper](https://callstack.github.io/react-native-paper/)** (MIT, Callstack) — simple Material buttons, large touch targets, bottom action bars for one-handed use.

### Other open-source kits worth knowing

| Kit | License | Why consider |
|-----|---------|--------------|
| **React Native Paper** *(we use this)* | MIT | Mature, Expo-friendly, big buttons / FAB / tabs |
| **[gluestack-ui](https://gluestack.io/)** | MIT | Fresh Tailwind/NativeWind copy-paste components |
| **[Tamagui](https://tamagui.dev/)** | MIT | High performance, universal theming |
| **[RNEUI](https://reactnativeelements.com/)** (Elements) | MIT | Easy starter components |
| **[UI Kitten](https://akveo.github.io/react-native-ui-kitten/)** | MIT | Eva Design System themes |

## Run (port 8082 — won’t steal 8081)

```powershell
cd mobile
npm run start:tunnel
```

## Env

Copy `.env.example` → `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Screens

- Auth: login / signup (bottom primary button)
- Tabs: Home, Create, Wallet (icon tabs)
- Create: mode switcher + sticky confirm
- Wallet: tap to select · sticky **Pay on Venmo** / **Mark paid**

## TestFlight (EAS)

1. `npx eas-cli login`
2. Bundle ID: `com.prodjex.theleague`
3. `npm run eas:build:ios` → submit when ready

Do not commit `.env`.
