---
name: mobile-secure-storage-auth
description: Use the `TokenStorage` adapter pattern to persist auth state on mobile via `expo-secure-store`. Use this when modifying the mobile auth flow, adding new persisted auth-adjacent data (e.g. cached user, biometric reauth flag), or wiring a new platform target.
---

# Mobile — Secure Storage Auth

Authentication state on mobile is persisted via the **`TokenStorage`** adapter from `@mma/client-common`, backed on the device by `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).

## Architecture

```
AuthProvider (client-common)
  ├── refreshSession() ──► auth-api-service (httpOnly refresh cookie, persisted by RN cookie jar)
  └── tokenStorage prop ──► createSecureTokenStorage() (apps/mobile/src/lib/secure-storage.ts)
                            ├── get(key) → SecureStore.getItemAsync
                            ├── set(key, value) → SecureStore.setItemAsync
                            └── remove(key) → SecureStore.deleteItemAsync
```

- **Refresh tokens** stay in httpOnly cookies. RN's network stack (NSURLSession on iOS, OkHttp on Android) automatically persists cookies across cold starts. The JS layer never sees the refresh token.
- **Cached user** (`MeResponse`) lives in SecureStore so the app shows the signed-in UI instantly on cold start, without waiting for the network round-trip.

## When to Read This Skill

- Mobile sign-in / sign-out flow changes.
- Adding new auth-adjacent persisted state (biometric flag, last-used email, device ID).
- Adding a new mobile platform / runtime (e.g. mobile web bundler).

## Required Information

1. **What value needs to persist?** Must be small and non-sensitive enough to live in SecureStore (Keychain has a ~4KB practical limit per item).
2. **What's the lifecycle?** Cleared on sign-out? Cleared on app uninstall? (SecureStore data is purged on app uninstall on both platforms.)

## Adding a Persisted Value

1. Add a new key to `TOKEN_STORAGE_KEYS` in `packages/client-common/src/lib/token-storage.ts`.
2. Read/write from inside `AuthProvider` (or a sibling provider that takes `tokenStorage` as a prop).
3. **Always wrap reads and writes in try/catch** — adapter failures must never break sign-in.

## Rules

1. **Refresh tokens MUST NOT be stored in JS via SecureStore.** The cookie store handles them. Storing the refresh token in JS breaks the security model (Golden Rule #24).
2. **Access tokens MUST stay in memory only** — never in SecureStore. They're short-lived and recoverable via silent refresh.
3. **TokenStorage operations are best-effort** — wrap every `set`/`remove` in `Promise.resolve().catch(() => undefined)` so storage errors don't propagate.
4. **Sign-out MUST clear all storage keys** for the user. Loop over `TOKEN_STORAGE_KEYS` and call `remove()` on each.
5. **Never log the value** of any stored key. Log keys only when debugging — values may contain PII.
6. **Web platforms pass `noopTokenStorage`** (the default). Cookie-based refresh covers the web flow already.

## Testing

Unit tests for `AuthProvider` should pass a fake adapter:
```ts
const fakeStorage: TokenStorage = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn(),
  remove: jest.fn(),
};
```

Mobile integration tests can use the real `createSecureTokenStorage()` against the simulator's keychain — but most tests should mock.

## Common Pitfalls

| Symptom | Cause |
|---|---|
| Cold start always shows login screen | `tokenStorage` prop not passed to `<AuthProvider>` in mobile `_layout.tsx`. |
| User stays signed in after sign-out | Sign-out handler missing `tokenStorage.remove(TOKEN_STORAGE_KEYS.USER)` call. |
| `SecureStore is not available` error in tests | Jest test for mobile must mock `expo-secure-store` or use a fake adapter. |
| Storage error crashes app | Adapter not wrapped in try/catch — adapter operations must always swallow errors. |
