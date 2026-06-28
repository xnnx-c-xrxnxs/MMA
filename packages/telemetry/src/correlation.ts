// ─── Request Context ──────────────────────────────────────────────────────────
//
// Provides request-scoped context propagation via Node.js AsyncLocalStorage.
// The store carries:
//   - correlationId — UUID generated per request (or reused from incoming
//     `x-correlation-id` header). Included in every structured log line and
//     auto-injected into outbound SQS event bodies / cross-service HTTP calls.
//   - authHeader    — raw `Authorization` header value of the originating HTTP
//     request. Forwarded by ACL adapters via `getOutboundHeaders()` so the
//     downstream service receives the same JWT (and `@CurrentUser()` resolves
//     to the original actor end-to-end).
//
// Both fields are optional inside the store. The legacy single-field
// helpers (`runWithCorrelationId`, `getCorrelationHeaders`) remain working
// unchanged for backward compatibility.
//
// Usage (HTTP API service main.ts):
//   import { correlationMiddleware } from '@old-st/telemetry';
//   app.use(correlationMiddleware());      // captures correlationId + authHeader
//
// Usage (event handler — in handleRecords):
//   import { runWithRequestContext } from '@old-st/telemetry';
//   runWithRequestContext({ correlationId: id }, () => processRecord(record));
//
// Usage (ACL adapter — outbound HTTP call):
//   import { getOutboundHeaders } from '@old-st/telemetry';
//   await axios.post(url, body, { headers: { ...getOutboundHeaders() } });
//
// Usage (anywhere — read current values):
//   const id = getCorrelationId();         // undefined outside a request context
//   const auth = getAuthHeader();          // undefined outside an authenticated request

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestContext {
  correlationId: string;
  authHeader?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function within a full request context (correlationId + optional auth).
 * Use this from non-HTTP entry points (SQS handlers, scheduled jobs) when you
 * need to forward both an inherited correlationId AND an inherited auth token.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Run a function within a correlation-only context.
 * Backward-compatible legacy helper — equivalent to
 * `runWithRequestContext({ correlationId }, fn)` with no authHeader.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/**
 * Get the current correlation ID from the async context.
 * Returns `undefined` when called outside a correlation context.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Get the current request's `Authorization` header value (e.g. `"Bearer eyJ..."`).
 * Returns `undefined` when called outside a request context, or when the
 * originating request had no `Authorization` header (public endpoints).
 *
 * Used by ACL adapters to forward the originating actor's JWT to downstream
 * services so `@CurrentUser()` resolves to the same actor end-to-end.
 */
export function getAuthHeader(): string | undefined {
  return storage.getStore()?.authHeader;
}

/**
 * Build HTTP headers that propagate the current correlation context only.
 * Returns `{ 'x-correlation-id': '...' }` when a correlation context is active,
 * otherwise an empty object. Backward-compatible — does NOT include the
 * Authorization header even when one is available.
 *
 * For full request propagation (correlationId + Authorization), use
 * `getOutboundHeaders()` instead. Keeping this helper for historical callers
 * and for cases where forwarding the user's JWT is undesirable.
 */
export function getCorrelationHeaders(): Record<string, string> {
  const id = getCorrelationId();
  return id ? { 'x-correlation-id': id } : {};
}

/**
 * Build HTTP headers that propagate the full request context — correlationId
 * AND the originating `Authorization` header. Use this in ACL adapters so the
 * downstream service sees the same actor (and the same correlation chain).
 *
 *   headers: { 'Content-Type': 'application/json', ...getOutboundHeaders() }
 *
 * Returns an empty object when no context is active, so it is safe to spread
 * unconditionally.
 */
export function getOutboundHeaders(): Record<string, string> {
  const store = storage.getStore();
  if (!store) return {};
  const headers: Record<string, string> = {};
  if (store.correlationId) headers['x-correlation-id'] = store.correlationId;
  if (store.authHeader) headers['Authorization'] = store.authHeader;
  return headers;
}

/**
 * Express-compatible middleware that establishes the request context.
 * Captures (or generates) the correlationId and stores the raw `Authorization`
 * header so downstream code can read it via `getAuthHeader()` or forward it
 * via `getOutboundHeaders()`.
 *
 * If the incoming request has an `x-correlation-id` header, it is reused
 * (useful for cross-service HTTP calls that want to share the same chain).
 *
 * Usage in NestJS main.ts:
 *   import { correlationMiddleware } from '@old-st/telemetry';
 *   // inside setupGlobalMiddleware() — must be the FIRST middleware:
 *   app.use(correlationMiddleware());
 */
export function correlationMiddleware() {
  return (
    req: { headers?: Record<string, string | string[] | undefined> },
    _res: unknown,
    next: () => void,
  ) => {
    const headers = req.headers ?? {};
    const existing = headers['x-correlation-id'];
    const correlationId =
      typeof existing === 'string' && existing ? existing : randomUUID();
    const authRaw = headers['authorization'];
    const authHeader = typeof authRaw === 'string' && authRaw ? authRaw : undefined;
    storage.run({ correlationId, authHeader }, next);
  };
}

