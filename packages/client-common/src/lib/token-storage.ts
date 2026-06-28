/**
 * Platform-agnostic key/value storage abstraction for client-common.
 *
 * Implementations:
 * - Web (default): no-op — refresh tokens live in httpOnly cookies set by the
 *   auth API. Nothing to persist on the JS side.
 * - Mobile: backed by `expo-secure-store` via the `createSecureTokenStorage()`
 *   factory in `apps/mobile/src/lib/secure-storage.ts`. Persists serialized
 *   `MeResponse` (and any future biometric-protected secret) across cold starts
 *   so the user doesn't see a flash of the login screen on app launch.
 *
 * Methods may be sync OR async — adapters that need native bridges return
 * Promises. Always `await` callers.
 */
export interface TokenStorage {
  /** Read a value by key. Returns null when absent. */
  get(key: string): Promise<string | null> | string | null;
  /** Persist a value. */
  set(key: string, value: string): Promise<void> | void;
  /** Remove a value. */
  remove(key: string): Promise<void> | void;
}

/**
 * No-op storage used as the default on web, where refresh tokens are managed
 * via httpOnly cookies and there is nothing for client JS to persist.
 */
export const noopTokenStorage: TokenStorage = {
  get: () => null,
  set: () => undefined,
  remove: () => undefined,
};

/** Storage keys — keep centralised so adapters know what to clear on sign-out. */
export const TOKEN_STORAGE_KEYS = {
  /** Cached MeResponse JSON — used by mobile for offline-first cold starts. */
  USER: 'oldst.auth.user',
} as const;
