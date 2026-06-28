import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from '@old-st/client-common';

/**
 * Mobile token storage backed by expo-secure-store.
 *
 * Persists a small amount of auth-related data (currently the cached
 * `MeResponse`) in the platform's secure key store — Keychain on iOS,
 * EncryptedSharedPreferences on Android. Survives app cold starts.
 *
 * Refresh tokens themselves are still managed via the platform's HTTP
 * cookie store (RN automatically persists cookies on iOS/Android), so
 * silent refresh works without storing the refresh token in JS memory.
 */
export function createSecureTokenStorage(): TokenStorage {
  return {
    async get(key: string): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // best-effort — caching failures must never block sign-in
      }
    },
    async remove(key: string): Promise<void> {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // ignore
      }
    },
  };
}
