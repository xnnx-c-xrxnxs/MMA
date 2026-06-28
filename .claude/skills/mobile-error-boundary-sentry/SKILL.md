---
name: mobile-error-boundary-sentry
description: Wire Sentry error tracking and render-error boundaries into the mobile app. Use this when adding Sentry, configuring sourcemap upload, or adding per-screen error boundaries.
---

# Mobile — Error Boundary + Sentry

The mobile app uses `@sentry/react-native` for crash and error reporting. Initialisation is centralised in `apps/mobile/src/app/_layout.tsx`.

## Architecture

| Layer | Component | Captures |
|---|---|---|
| Native | `Sentry.init()` in `_layout.tsx` | Native crashes, unhandled JS rejections, performance traces |
| Root | `Sentry.wrap(RootLayout)` | Render errors anywhere in the tree, fatal JS errors |
| Per-screen | `<ErrorBoundary>` from `@old-st/mobile-ui` | Recoverable render errors with retry UI |

## When to Read This Skill

- Setting up Sentry for the first time.
- Wrapping a new screen in a per-screen error boundary.
- Modifying the `Sentry.init()` config.
- Configuring sourcemap upload via EAS.

## Required Information

1. **Sentry DSN.** From the Sentry project settings → Client Keys.
2. **Sentry org + project slug.** For sourcemap uploads via `@sentry/cli`.
3. **Sentry auth token.** Stored as an EAS secret named `SENTRY_AUTH_TOKEN`.

## Configuration

### 1. DSN via env

Add to mobile env (any of):
- `EXPO_PUBLIC_SENTRY_DSN` in `.env.local`.
- `eas.json` → `build.{profile}.env.EXPO_PUBLIC_SENTRY_DSN`.
- `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>`.

The DSN is read in `_layout.tsx` from `Constants.expoConfig.extra.sentryDsn`.

### 2. Sourcemap upload

Add `expo-eas-update` config + create `sentry.properties` at `apps/mobile/`:
```
defaults.org=<org-slug>
defaults.project=<project-slug>
auth.token=$SENTRY_AUTH_TOKEN
```

EAS Build runs the Sentry post-build hook automatically when `@sentry/react-native` is installed and `SENTRY_AUTH_TOKEN` is set.

### 3. Per-screen error boundaries

Wrap any screen tree that does heavy data manipulation:
```tsx
import { ErrorBoundary } from '@old-st/mobile-ui';

export default function OrdersScreen() {
  return (
    <ErrorBoundary onError={(err) => Sentry.captureException(err)}>
      <OrdersContent />
    </ErrorBoundary>
  );
}
```

## Rules

1. **Never put the DSN as a literal in code.** Always via env / `expo.extra`.
2. **Always pass `onError` to per-screen boundaries** so Sentry receives the error. The root `Sentry.wrap()` covers fatal cases; per-screen boundaries for graceful UI recovery.
3. **Set `tracesSampleRate` low in production** (≤0.2). Higher rates burn through Sentry quota fast on mobile.
4. **`environment` must match the app channel** (`development` / `preview` / `production`) so Sentry alerts can filter correctly.
5. **Don't capture PII**. Configure `Sentry.setUser()` only with the userId — never email or other identifiable data.
6. **Sourcemap upload must happen on every prod build** — without it, Sentry stack traces show minified bundle code.

## Common Pitfalls

| Symptom | Cause |
|---|---|
| No events in Sentry | DSN missing from `extra` block. Check `Constants.expoConfig.extra.sentryDsn`. |
| Stack traces are minified | `SENTRY_AUTH_TOKEN` not set as EAS secret, or `sentry.properties` missing. |
| Per-screen boundary doesn't catch async errors | Error boundaries only catch render errors. Use `try/catch` + `Sentry.captureException()` for async failures. |
| Sentry quota exhausted | `tracesSampleRate` too high. Lower to ≤0.2 for production. |

## Testing

Unit tests should mock `@sentry/react-native`:
```ts
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c: unknown) => c,
  captureException: jest.fn(),
}));
```
