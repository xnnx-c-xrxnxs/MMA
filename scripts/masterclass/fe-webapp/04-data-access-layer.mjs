// Module 04 — Data-Access Layer
// Compares Axios class inheritance (old) with typed fetch + Zod (new).

export default {
    id: '04-data-access-layer',
    level: 3,
    complexityLabel: 'L3 · Data Access',
    domain: 'Infrastructure',
    title: 'Data-Access Layer',
    introShort: 'Replace Axios class inheritance + runtime env loading with typed fetch + Zod response parsing.',
    intro: "The old template used an AxiosConfig base class that loaded environment variables asynchronously inside the constructor, applied interceptors for auth, and returned raw untyped response bodies. The new template replaces this with a single apiRequest<T>() function using the native fetch API — no Axios dependency, responses validated by Zod schemas from the shared contracts package, and a single configureApi() call at boot.",

    specTitle: 'Data Access · API Clients',
    specBodyHtml: `
    <p><strong>Old approach — Axios class inheritance:</strong></p>
    <ul>
      <li><code>AxiosConfig</code> base class reads env vars via an <em>async</em> <code>getEnv()</code> inside the constructor — env is not available synchronously at class creation time.</li>
      <li>Each API service creates a subclass: <code>class AuthApi extends AxiosConfig</code>.</li>
      <li>Axios interceptors handle token injection and 401 redirects.</li>
      <li>Response bodies are returned as <code>any</code> — no runtime validation.</li>
      <li>Depends on the <code>axios</code> and <code>js-cookie</code> packages.</li>
    </ul>
    <p><strong>New approach — <code>apiRequest&lt;T&gt;()</code> + Zod:</strong></p>
    <ul>
      <li><code>configureApi()</code> is called once in <code>layout.tsx</code> — synchronous, no async constructor issues.</li>
      <li><code>apiRequest&lt;T&gt;()</code> is a plain <code>async function</code> using native <code>fetch</code> — zero new dependencies.</li>
      <li>Every API client method passes a <code>schema: ZodType&lt;T&gt;</code> option — the response is parsed and typed at the boundary.</li>
      <li>A <code>401</code> triggers a silent token refresh; if refresh fails, the user is signed out.</li>
      <li>The same clients work on both the webapp and the Expo mobile app (no browser globals).</li>
    </ul>
  `,

    entityFilename: 'base-api.client.ts',
    entityCode: `// packages/client-common/src/infrastructure/api-clients/base-api.client.ts
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — libs/frontend/data-access/src/api/axiosConfig.ts
// ─────────────────────────────────────────────────────────────────
// export class AxiosConfig {
//   protected axiosInstance: AxiosInstance;
//
//   constructor(baseURLEnvVar: keyof EnvVariables | null, ...) {
//     this.axiosInstance = axios.create({ timeout: 150000, ... });
//     this.initializeBaseURL(baseURLEnvVar); // ← async, fires and forgets!
//     this.addInterceptor(...);
//   }
//
//   private async initializeBaseURL(envVar) {
//     const env = await getEnv();            // ← HTTP call to /config.json
//     this.axiosInstance.defaults.baseURL = env[envVar];
//   }
// }
// Problems: async constructor, untested interceptors, no response validation.

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — base-api.client.ts
// ─────────────────────────────────────────────────────────────────
import { type ZodType } from 'zod';
import { ApiError } from '../errors/api-error';

// ── Token management ─────────────────────────────────────────────────────
let accessTokenGetter: (() => string | null) | null = null;
let onUnauthorized: (() => Promise<boolean>) | null = null;
let isRefreshing = false;

export function setAccessTokenGetter(getter: () => string | null): void {
  accessTokenGetter = getter;
}
export function setOnUnauthorized(handler: () => Promise<boolean>): void {
  onUnauthorized = handler;
}

// ── Core request function ─────────────────────────────────────────────────
export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string | number | undefined>;
    schema?: ZodType<T>;          // ← Zod schema validates the response at runtime
  },
): Promise<T> {
  const { method = 'GET', body, headers, params, schema } = options ?? {};

  // Build URL with optional query parameters
  const url = new URL(\`\${baseUrl}\${path}\`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  // Attach the in-memory access token (never read from localStorage)
  const token = accessTokenGetter?.();
  const authHeaders: Record<string, string> = token
    ? { Authorization: \`Bearer \${token}\` }
    : {};

  let response = await fetch(url.toString(), {
    method,
    credentials: 'include',           // sends httpOnly refresh cookie
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Silent token refresh on 401
  if (response.status === 401 && !isRefreshing && onUnauthorized) {
    isRefreshing = true;
    const refreshed = await onUnauthorized();
    isRefreshing = false;
    if (refreshed) {
      const newToken = accessTokenGetter?.();
      response = await fetch(url.toString(), {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: \`Bearer \${newToken}\` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (response.status === 204) return undefined as T;

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      responseBody?.error ?? response.statusText,
      responseBody?.message ?? 'An unexpected error occurred',
    );
  }

  // ✅ Zod parse validates the shape BEFORE returning to the hook
  return schema ? schema.parse(responseBody) : (responseBody as T);
}`,

    concepts: [
        'configureApi() is called once at app boot — no async constructors',
        'Native fetch — no Axios dependency (works in Node, browser, React Native)',
        'Zod schema validates every response at the client boundary',
        'Access token is memory-only — never in localStorage',
        'Silent 401 → refresh → retry without the caller knowing',
        'Same apiRequest<T>() shared by webapp and Expo mobile',
    ],

    exceptionsFilename: 'auth-api.client.ts',
    exceptionsCode: `// packages/client-common/src/infrastructure/api-clients/auth-api.client.ts
//
// Each domain gets a thin client file — just named functions, no classes.
// ─────────────────────────────────────────────────────────────────
//  OLD — libs/frontend/data-access/src/api/auth.ts
// ─────────────────────────────────────────────────────────────────
// export class AuthApi extends AxiosConfig {
//   constructor() {
//     super('AUTH_API_URL', false, false);  // 'false' = no auth header
//   }
//   async login(email: string, password: string): Promise<LoginResponse> {
//     return this.axiosInstance.post('/auth/sign-in', { email, password });
//     // ↑ returns response.data.body — untyped, no validation
//   }
// }

// ─────────────────────────────────────────────────────────────────
//  NEW — auth-api.client.ts
// ─────────────────────────────────────────────────────────────────
import { signInResponseSchema, refreshSessionResponseSchema } from '@old-st/contracts/auth';
import { getApiConfig } from '../config';
import { apiRequest } from './base-api.client';

// Plain named functions — no class, no 'this', no inheritance.
export async function signIn(email: string, password: string) {
  return apiRequest(
    getApiConfig().authApiUrl,
    '/auth/sign-in',
    {
      method: 'POST',
      body: { email, password },
      schema: signInResponseSchema,   // ← schema from @old-st/contracts/auth
    },
  );
}

export async function refreshSession() {
  return apiRequest(
    getApiConfig().authApiUrl,
    '/auth/refresh-session',
    {
      method: 'POST',
      credentials: 'include',         // sends httpOnly refresh cookie
      schema: refreshSessionResponseSchema,
    },
  );
}

export async function signOut() {
  return apiRequest(getApiConfig().authApiUrl, '/auth/sign-out', { method: 'POST' });
}`,

    pitfalls: [
        "<strong>Returning <code>any</code> from API clients:</strong> if you skip the <code>schema</code> option, TypeScript will infer <code>unknown</code> and every consumer must cast. Always pass a Zod schema — it's runtime safety AND TypeScript inference in one step.",
        "<strong>Creating per-app API client classes:</strong> the old Axios class pattern tempts duplication. The new rule: add a new <em>function</em> to the existing domain client file (<code>auth-api.client.ts</code>) — never create a new class.",
        "<strong>Reading <code>process.env</code> inside a hook or client:</strong> env vars are configured once at boot via <code>configureApi()</code>. Inside a client, always call <code>getApiConfig().userApiUrl</code>.",
    ],
};
