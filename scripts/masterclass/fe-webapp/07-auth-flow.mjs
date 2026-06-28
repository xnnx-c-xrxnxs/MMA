// Module 07 — Auth Flow: Cookies, Tokens, and the useAuth() Hook
// Compares cookie-based session (old) with httpOnly refresh + memory access token (new).

export default {
    id: '07-auth-flow',
    level: 4,
    complexityLabel: 'L4 · Security',
    domain: 'Authentication',
    title: 'Auth Flow — Tokens & Cookies',
    introShort: 'httpOnly refresh cookie + memory-only access token replace js-cookie localStorage auth.',
    intro: "The old template stored tokens in cookies readable by JavaScript (js-cookie) and loaded them at component render time. The new template follows the secure browser token pattern: the refresh token lives in an httpOnly cookie (unreadable by JS), the access token lives only in memory (lost on reload, restored by silent refresh), and a single useAuth() hook from client-common manages the full lifecycle.",

    specTitle: 'Authentication · Token Rules',
    specBodyHtml: `
    <p><strong>Old template auth risks:</strong></p>
    <ul>
      <li>Tokens stored in <code>js-cookie</code> — readable from JavaScript → XSS risk.</li>
      <li>Session ID in a cookie: <code>Cookies.get(STORAGE_KEY.SESSION_ID)</code>.</li>
      <li>Auth state duplicated: cookie + React Context + Axios interceptor.</li>
      <li>No silent refresh — user hit 401 and saw an error.</li>
      <li><code>ProtectedRoute</code> component had to know the auth implementation.</li>
    </ul>
    <p><strong>New template secure flow (Golden Rules #24–#28):</strong></p>
    <ul>
      <li><strong>Refresh token</strong> → httpOnly, Secure, SameSite cookie — JS cannot read it.</li>
      <li><strong>Access token</strong> → in-memory only (<code>setAccessTokenGetter()</code> in <code>AuthProvider</code>).</li>
      <li>On page load: <code>POST /auth/refresh-session</code> with <code>credentials: 'include'</code> restores the session silently.</li>
      <li>On 401: <code>apiRequest</code> calls <code>onUnauthorized()</code> → refresh → retry automatically.</li>
      <li>All API calls use <code>credentials: 'include'</code> so the browser sends the httpOnly cookie.</li>
      <li>CORS: backend sets <code>origin: process.env.FE_BASE_URL, credentials: true</code> — never <code>origin: '*'</code>.</li>
    </ul>
    <p><strong>Security boundary reminder:</strong> client-side auth is UX only. Every data endpoint validates the JWT at the API Gateway + NestJS guard level.</p>
  `,

    entityFilename: 'use-auth.ts',
    entityCode: `// packages/client-common/src/hooks/use-auth.ts
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — session read from cookie in every component
// ─────────────────────────────────────────────────────────────────
// // Inside a component (old):
// import Cookies from 'js-cookie';
// const token = Cookies.get('access_token');     ← XSS-readable
// const sessionId = Cookies.get('sessionId');    ← also readable
// if (!token) router.push('/auth/login');

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — useAuth() hook from client-common
// ─────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { refreshSession, signIn as apiSignIn, signOut as apiSignOut } from '../infrastructure/api-clients/auth-api.client';
import { setAccessTokenGetter, setOnUnauthorized } from '../infrastructure/api-clients/base-api.client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
}

const AuthContext = createContext<AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,    // true until silent refresh resolves
    userId: null,
    email: null,
  });

  // Access token stored in a closure — never in localStorage or a cookie
  let accessToken: string | null = null;

  // Register the getter with the base API client
  useEffect(() => {
    setAccessTokenGetter(() => accessToken);
    setOnUnauthorized(async () => {
      try {
        const res = await refreshSession();  // uses httpOnly cookie
        accessToken = res.accessToken;
        setState({ isAuthenticated: true, isLoading: false, userId: res.userId, email: res.email });
        return true;
      } catch {
        accessToken = null;
        setState({ isAuthenticated: false, isLoading: false, userId: null, email: null });
        return false;
      }
    });
  }, []);

  // ── Restore session on cold load ──────────────────────────────────────
  useEffect(() => {
    refreshSession()
      .then(res => {
        accessToken = res.accessToken;
        setState({ isAuthenticated: true, isLoading: false, userId: res.userId, email: res.email });
      })
      .catch(() => {
        setState(s => ({ ...s, isLoading: false }));  // not authenticated, stop spinner
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiSignIn(email, password);
    if (res.type === 'SUCCESS') {
      accessToken = res.accessToken;
      setState({ isAuthenticated: true, isLoading: false, userId: res.userId, email: res.email });
    }
    // Discriminated union: other types (NEW_PASSWORD_REQUIRED etc.) handled by caller
    return res;
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    accessToken = null;
    setState({ isAuthenticated: false, isLoading: false, userId: null, email: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Single hook consumed by every component that needs auth state.
// Zero knowledge of httpOnly cookies, Axios interceptors, or session storage.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}`,

    concepts: [
        'Refresh token in httpOnly cookie — JS cannot read it (XSS safe)',
        'Access token in memory — lost on reload, restored by silent refresh on mount',
        'credentials: include on all fetches — browser sends httpOnly cookie automatically',
        'setAccessTokenGetter() wires the token into every apiRequest<T>() call',
        'Discriminated union sign-in response: SUCCESS | NEW_PASSWORD_REQUIRED | MFA_REQUIRED',
        'useAuth() is the single source of auth truth — no direct cookie reads',
    ],

    exceptionsFilename: 'providers.tsx',
    exceptionsCode: `// packages/client-common/src/lib/providers.tsx
//
// Wraps children with QueryClientProvider + AuthProvider.
// Called once in apps/webapp/src/app/layout.tsx.
// Also used in apps/mobile/src/app/_layout.tsx.
//
'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/use-auth';
import { queryClient } from './query-client';
import { configureApi } from '../infrastructure/config';

interface ApiConfig {
  userApiUrl?: string;
  productApiUrl?: string;
  orderApiUrl?: string;
  authApiUrl?: string;
  fileApiUrl?: string;
}

export function Providers({
  children,
  apiConfig,
}: {
  children: React.ReactNode;
  apiConfig?: ApiConfig;
}) {
  // configureApi is idempotent — safe to call on every render in dev.
  // In production (static export) this runs once on the client.
  if (apiConfig) configureApi(apiConfig);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

// ─── apps/webapp/src/app/layout.tsx (excerpt) ─────────────────────────────
//
// const apiConfig = {
//   userApiUrl:    process.env.NEXT_PUBLIC_API_USER_URL,
//   productApiUrl: process.env.NEXT_PUBLIC_API_PRODUCT_URL,
//   orderApiUrl:   process.env.NEXT_PUBLIC_API_ORDER_URL,
//   authApiUrl:    process.env.NEXT_PUBLIC_API_AUTH_URL,
// };
//
// export default function RootLayout({ children }) {
//   return (
//     <html lang="en" suppressHydrationWarning>
//       <body>
//         <ThemeProvider>
//           <Providers apiConfig={apiConfig}>    ← one call, all setup done
//             {children}
//             <Toaster />
//           </Providers>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }`,

    pitfalls: [
        '<strong>Storing tokens in <code>localStorage</code>:</strong> localStorage is readable by any JavaScript on the page — one XSS injection and the attacker has the token. Memory-only access tokens expire with the tab.',
        "<strong>Reading auth state outside <code>useAuth()</code>:</strong> never import or call a cookie library directly in a component. If you need the user's ID, use <code>const { userId } = useAuth()</code>.",
        "<strong>Using <code>origin: '*'</code> with <code>credentials: true</code>:</strong> browsers block this combination. The backend must set a specific origin from <code>process.env.FE_BASE_URL</code>.",
    ],
};
