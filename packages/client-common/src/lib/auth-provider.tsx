'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApiClient } from '../infrastructure/api-clients/auth-api.client';
import {
  setAccessTokenGetter,
  setOnUnauthorized,
} from '../infrastructure/api-clients/base-api.client';
import type { MeResponse, SignInResponse, AuthTokens } from '@old-st/contracts/auth';
import {
  noopTokenStorage,
  TOKEN_STORAGE_KEYS,
  type TokenStorage,
} from './token-storage';

/**
 * Non-secret session-marker cookie. The webapp's Next.js edge middleware reads
 * this on protected routes to decide whether to redirect to /auth/login
 * before any client JS runs (avoids the flash of protected UI). The real
 * auth check still happens at the API on every request — the marker is
 * only an optimisation. Browser-only; no-op in non-browser runtimes.
 */
const SESSION_MARKER = 'oldst.session';

function setSessionMarker(): void {
  if (typeof document === 'undefined') return;
  // SameSite=Lax is sufficient — same-origin reads only. No Secure flag in
  // dev so localhost works; the marker carries no auth value either way.
  const isHttps =
    typeof location !== 'undefined' && location.protocol === 'https:';
  document.cookie = `${SESSION_MARKER}=1; Path=/; SameSite=Lax${
    isHttps ? '; Secure' : ''
  }`;
}

function clearSessionMarker(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_MARKER}=; Path=/; Max-Age=0; SameSite=Lax`;
}

interface AuthContextValue {
  /** Current user info (null when not authenticated) */
  user: MeResponse | null;
  /** Whether auth is still being determined (initial refresh) */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Sign in with email and password */
  signIn: (
    email: string,
    password: string,
  ) => Promise<SignInResponse>;
  /** Complete new password challenge */
  completeNewPassword: (
    email: string,
    newPassword: string,
    session: string,
  ) => Promise<AuthTokens>;
  /** Sign out (clears token + cookie) */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Platform-aware token storage. Defaults to a no-op (web). Mobile passes a
   * SecureStore-backed adapter so the cached user is rehydrated on cold start.
   * The adapter is only used for caching the public `MeResponse` — refresh
   * tokens still live in httpOnly cookies handled by the network stack.
   */
  tokenStorage?: TokenStorage;
}

export function AuthProvider({
  children,
  tokenStorage = noopTokenStorage,
}: AuthProviderProps) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  // Register the token getter so all fetch calls include the Bearer header
  useEffect(() => {
    setAccessTokenGetter(() => accessTokenRef.current);
  }, []);

  const storeTokens = useCallback((tokens: AuthTokens) => {
    accessTokenRef.current = tokens.accessToken;
    setSessionMarker();
    // Decode user info from the id token
    try {
      const parts = tokens.idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
        );
        const decoded: MeResponse = {
          userId: payload['custom:userId'] || payload.sub,
          email: payload.email,
          userRole: payload['custom:userRole'] || '',
        };
        setUser(decoded);
        // Persist for offline cold-start on mobile (no-op on web).
        void Promise.resolve(
          tokenStorage.set(TOKEN_STORAGE_KEYS.USER, JSON.stringify(decoded)),
        ).catch(() => undefined);
      }
    } catch {
      // If token decode fails, fetch user info from /me endpoint
      authApiClient
        .me()
        .then((me) => {
          setUser(me);
          void Promise.resolve(
            tokenStorage.set(TOKEN_STORAGE_KEYS.USER, JSON.stringify(me)),
          ).catch(() => undefined);
        })
        .catch(() => setUser(null));
    }
  }, [tokenStorage]);

  const silentRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const tokens = await authApiClient.refreshSession();
      storeTokens(tokens);
      return true;
    } catch {
      accessTokenRef.current = null;
      setUser(null);
      clearSessionMarker();
      void Promise.resolve(tokenStorage.remove(TOKEN_STORAGE_KEYS.USER)).catch(
        () => undefined,
      );
      return false;
    }
  }, [storeTokens, tokenStorage]);

  // Register the 401 handler for automatic refresh
  useEffect(() => {
    setOnUnauthorized(silentRefresh);
  }, [silentRefresh]);

  // On mount: rehydrate cached user (mobile) immediately for instant UI,
  // then attempt silent refresh to confirm session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await Promise.resolve(
          tokenStorage.get(TOKEN_STORAGE_KEYS.USER),
        );
        if (!cancelled && cached) {
          try {
            setUser(JSON.parse(cached) as MeResponse);
          } catch {
            // ignore parse errors
          }
        }
      } catch {
        // ignore storage errors — cache is best-effort
      }
      await silentRefresh();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [silentRefresh, tokenStorage]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResponse> => {
      const result = await authApiClient.signIn(email, password);
      if (result.type === 'SUCCESS') {
        storeTokens(result.tokens);
      }
      return result;
    },
    [storeTokens],
  );

  const completeNewPassword = useCallback(
    async (
      email: string,
      newPassword: string,
      session: string,
    ): Promise<AuthTokens> => {
      const tokens = await authApiClient.completeNewPassword(
        email,
        newPassword,
        session,
      );
      storeTokens(tokens);
      return tokens;
    },
    [storeTokens],
  );

  const signOut = useCallback(async () => {
    try {
      await authApiClient.signOut();
    } catch {
      // Proceed with local cleanup even if API call fails
    }
    accessTokenRef.current = null;
    setUser(null);
    clearSessionMarker();
    void Promise.resolve(tokenStorage.remove(TOKEN_STORAGE_KEYS.USER)).catch(
      () => undefined,
    );
  }, [tokenStorage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      completeNewPassword,
      signOut,
    }),
    [user, isLoading, signIn, completeNewPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
