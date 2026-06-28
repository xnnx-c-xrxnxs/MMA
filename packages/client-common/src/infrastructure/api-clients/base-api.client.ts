import { type ZodType } from 'zod';
import { ApiError } from '../errors/api-error';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// ── Token management (set by AuthProvider, consumed by all API calls) ─────
let accessTokenGetter: (() => string | null) | null = null;
let onUnauthorized: (() => Promise<boolean>) | null = null;
// Prevents re-entrant calls: if refresh-session itself returns 401 we must
// not call onUnauthorized again (infinite loop).
let isRefreshing = false;

/**
 * Register a function that returns the current access token.
 * Called once by the AuthProvider during initialization.
 */
export function setAccessTokenGetter(getter: () => string | null): void {
  accessTokenGetter = getter;
}

/**
 * Register a callback invoked on 401 responses to attempt silent token refresh.
 * Should return `true` if refresh succeeded (caller retries the request).
 */
export function setOnUnauthorized(handler: () => Promise<boolean>): void {
  onUnauthorized = handler;
}

async function handleResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const statusCode = response.status;
    const error = body?.error ?? response.statusText;
    const message = body?.message ?? 'An unexpected error occurred';
    throw new ApiError(statusCode, error, message);
  }

  return body;
}

function buildUrl(base: string, path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options?: RequestOptions & { params?: Record<string, string | number | undefined>; schema?: ZodType<T> },
): Promise<T> {
  const { method = 'GET', body, headers, params, schema } = options ?? {};
  const url = buildUrl(baseUrl, path, params);

  const authHeaders: Record<string, string> = {};
  const token = accessTokenGetter?.();
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // On 401, attempt silent refresh and retry once (guard against re-entrancy)
  if (response.status === 401 && onUnauthorized && !isRefreshing) {
    isRefreshing = true;
    const refreshed = await onUnauthorized().finally(() => {
      isRefreshing = false;
    });
    if (refreshed) {
      const retryToken = accessTokenGetter?.();
      const retryHeaders: Record<string, string> = {};
      if (retryToken) {
        retryHeaders['Authorization'] = `Bearer ${retryToken}`;
      }
      response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...retryHeaders,
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    }
  }

  const data = await handleResponse(response);

  if (schema && data !== undefined) {
    return schema.parse(data) as T;
  }

  return data as T;
}

export async function apiRequestVoid(
  baseUrl: string,
  path: string,
  options?: RequestOptions,
): Promise<void> {
  const { method = 'DELETE', body, headers } = options ?? {};
  const url = `${baseUrl}${path}`;

  const authHeaders: Record<string, string> = {};
  const token = accessTokenGetter?.();
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  await handleResponse(response);
}
