# Daiyly UI Components

Actual components that exist on disk. All documented in FLOWS.md Components Reference section.

## Component Index

| Component | File | Exports | Used By |
|-----------|------|---------|---------|
| Button | Button.tsx | `Button` (default) | login, register, settings |
| Input | Input.tsx | `Input` (default) | login, register, settings |
| Modal | Modal.tsx | `Modal` (default) | settings (delete account password) |
| AppleSignInButton | AppleSignInButton.tsx | `AppleSignInButton` (default) | login, register |
| CTABanner | CTABanner.tsx | `CTABanner` (default), `MinimalCTABanner` (named) | insights |
| MoodCard | MoodCard.tsx | `MoodCard` (default), `ShareableMoodCard`, `MoodBentoGrid`, `getMoodLabel` | home, sharing |
| ShareableResult | ShareableResult.tsx | `ShareableResult` (default), `MinimalShareCard` (named) | sharing |

## Dependencies

| Package | Used By |
|---------|---------|
| `expo-linear-gradient` | CTABanner, MoodCard, ShareableResult |
| `expo-apple-authentication` | AppleSignInButton |
| `react-native-view-shot` | ShareableResult |
| `expo-sharing` | ShareableResult |
| `clsx` + `tailwind-merge` | Button, Input (via `lib/cn.ts`) |

Last updated: 2026-02-25
