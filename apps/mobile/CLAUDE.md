# Mobile App Rules

This file loads automatically for any file inside `apps/mobile/`. Full documentation: `docs/mobile-development-handbook.md`.

---

## Architecture

- **Screens are thin orchestrators** — wire hooks + state + child components. No list markup or direct API calls in screen files.
- **Domain components** live in `src/components/{domain}/`. Shared cross-domain components in `src/components/shared/`.
- **Tests** are co-located — `.spec.tsx` next to the source file (e.g. `src/components/auth/login-form.spec.tsx`).

## Data Access

- **All API calls** go through `@old-st/client-common` hooks and API clients — never call `fetch` directly.
- **No mobile-only API clients** — add to `@old-st/client-common` (shared with webapp).
- **No Redux/Zustand/MobX** — React Query for server state, `useState` for UI state.

## UI & Styling

- Use **`@old-st/mobile-ui`** primitives (Badge, Button, Card, Text, Input, etc.) — never raw `View`/`Text` for interactive elements.
- Use **`StyleSheet.create()`** at the bottom of the file — no inline style objects for static styles.
- Use **theme tokens** (`colors`, `spacing`, `radii`, `fontSizes` from `@old-st/mobile-ui`) — never hardcode colors or spacing values.
- Use **`FlatList`** for lists — never `ScrollView` + `.map()`.

## Contracts & Types

- Import from **`@old-st/contracts/{domain}`** — never bare `@old-st/contracts`.
- Use **domain enum constants** (e.g. `UserStatusEnum.ACTIVE`) — never string literals.

## Auth

- Auth state via **`useAuth()`** from `@old-st/client-common`.
- Token persistence via **`expo-secure-store`** (`src/lib/secure-storage.ts`).
- Refresh tokens live in httpOnly cookies — never store in JS.

## Timezone Handling — UTC in, local out

**The backend always stores and returns timestamps in UTC.** The frontend is solely responsible for converting to the display timezone.

**Default display timezone: `Europe/London`** (covers GMT/BST automatically). Override per-project when requirements differ.

Use the helpers from `@old-st/client-common` (implemented in `packages/client-common/src/lib/format-date.ts`, shared with webapp):

```tsx
import { formatDate, formatDateTime, formatTime } from '@old-st/client-common';

<Text>{formatDateTime(order.createdAt)}</Text>   // '13 May 2026, 14:30'
<Text>{formatDate(user.dateCreated)}</Text>       // '13 May 2026'
```

**Rules:**
- Never call `.toLocaleDateString()` or `.toString()` on a Date — device locale is unpredictable.
- Never receive a pre-formatted string from the backend — always ISO 8601 UTC, format in the frontend.
- To use the **device's own timezone**, pass `Intl.DateTimeFormat().resolvedOptions().timeZone` as the `timeZone` argument to the helper.

## Forms

- Use **`react-hook-form`** + `@hookform/resolvers/zod` with schemas from `@old-st/contracts/{domain}`.

## Error Reporting & Releases

- **Sentry is required.** All native crashes and JS errors report via `@sentry/react-native`. `Sentry.init()` runs in `_layout.tsx`; the root layout is wrapped in `Sentry.wrap()`; per-screen `<ErrorBoundary>` calls `Sentry.captureException`. See the `mobile-error-boundary-sentry` skill.
- **Mobile releases go through `cd-mobile-deploy.yml` — never local `eas build`/`eas update` for production.** `runtimeVersion` is `{ policy: 'appVersion' }`. Bump `version` in `app.config.ts` whenever a native dep changes. See the `mobile-cd-pipeline` skill.
- **Deep links use the `oldst://` scheme + per-env Universal/App Links.** Config in `apps/mobile/app.config.ts`; verification files hosted at `https://{domain}/.well-known/`. See the `mobile-deep-linking` skill.

## Navigation

- **File-based routing** via Expo Router. Tabs in `(tabs)/`, auth screens in `auth/`, detail screens use `[paramId].tsx`.
- Use **`useLocalSearchParams()`** for route params — never parse manually.
