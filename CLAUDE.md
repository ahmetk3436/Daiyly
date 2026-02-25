# Daiyly — CLAUDE.md

## App Identity
- **Name**: Daiyly
- **Tagline**: Your daily journaling companion
- **Bundle ID**: com.ahmetkizilkaya.daiyly
- **Category**: Lifestyle (Journaling/Diary)
- **Repo**: github.com/ahmetk3436/Daiyly (private)

## Tech Stack
- Expo SDK 54, React Native 0.81.5, Expo Router v6
- NativeWind v4 (className only, NO StyleSheet)
- TypeScript throughout
- Backend: unified-backend at port 8099

## Design System
- Primary: #2563EB (blue), Secondary: #8B5CF6 (violet), Accent: #F59E0B (amber)
- Dark mode: CSS variables in global.css, ThemeContext with system/light/dark
- Colors in tailwind.config.js with darkMode: 'class'

## Architecture
- **Routing**: Expo Router v6 file-based — (auth)/, (protected)/
- **Providers**: AuthContext, SubscriptionContext, ThemeContext (in _layout.tsx)
- **Styling**: NativeWind v4 + CSS variables for light/dark theming
- **Tab bar**: Custom tabs (Home, Insights, Calendar, Settings)

## Key Features
1. Daily journal entries with mood emoji + text
2. Mood tracking with emoji wheel
3. AI weekly insights (premium)
4. Word cloud analysis (premium)
5. Full-text search across entries (premium)
6. Shareable mood cards (3 types: entry, weekly, streak)
7. Dark mode (system/light/dark)
8. Streak tracking
9. Notification center with reminders

## Monetization
- **Model**: Subscription — $4.99/mo or $29.99/yr (annual pre-selected)
- **Trial**: 3-day free trial
- **Free tier**: Basic journaling, streak, basic insights
- **Premium**: AI insights, word cloud, full search, sharing, export
- **Payment**: RevenueCat (entitlement: "premium")
- **Pro gate**: useProGate hook + locked preview overlays in insights

## Files of Note
- `lib/purchases.ts` — Safe RevenueCat wrapper (Expo Go fallback)
- `lib/useProGate.tsx` — Premium feature gate hook
- `lib/biometrics.ts` — Face ID/Touch ID
- `lib/haptics.ts` — Haptic feedback helpers
- `contexts/ThemeContext.tsx` — Dark mode with CSS variable toggling
- `app/(protected)/sharing.tsx` — Image-based share cards with ViewShot
- `app/(protected)/paywall.tsx` — RevenueCat paywall with social proof
- `app/(protected)/insights.tsx` — Blurred premium previews (chart, word cloud, sentiment)

## Known Patterns
- printUpgradeWarning no-op (react-native-css-interop crash fix)
- Sentry no-op stub in _layout.tsx
- AsyncStorage for settings persistence (@daiyly_settings key)
- .env: EXPO_PUBLIC_API_URL=http://89.47.113.196:8099
- Privacy: vexellabspro.com/daiyly/privacy
- Terms: vexellabspro.com/daiyly/terms

## Spec Location
- Master spec: `../../product-factory/output/Daiyly/master_spec.json`
