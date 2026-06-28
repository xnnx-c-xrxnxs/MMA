---
name: webapp-auth-middleware
description: Add or update Next.js Edge middleware that gates access to protected route segments by reading the `oldst.session` marker cookie. Use this when adding a new protected URL prefix, integrating SSO from a different IdP, or troubleshooting redirect loops on the webapp.
---

# Webapp Auth Middleware

> **Static-mode note:** The default webapp uses `output: 'export'` (static deployment to S3 + CloudFront). **Edge middleware is not supported with static export.** If you are working on the default template, there is no `apps/webapp/src/middleware.ts` — auth redirect is client-side in `apps/webapp/src/app/(protected)/layout.tsx` via `useAuth()` + `useRouter()`. This skill applies if your team has switched to SSR mode (`output: 'standalone'` + Docker deployment).

The webapp uses **Next.js Edge middleware** to redirect unauthenticated users away from protected segments before any page or React tree renders. This is a **best-effort optimization** — the API still re-validates every request via JWT.

Source: `apps/webapp/src/middleware.ts`.

## Architecture: why a marker cookie?

The auth API (`apps/auth/auth-api-service`) issues an `httpOnly` `refresh_token` cookie scoped to the **auth-api origin**, not the webapp origin. Edge middleware running on the webapp origin **cannot read** that cookie. The webapp solves this with a non-secret marker cookie:

```
Cookie name: oldst.session
Value:       1
Scope:       Path=/; SameSite=Lax (+ Secure when https)
HttpOnly:    no  ← read/written by client JS
```

The marker is written by `AuthProvider.storeTokens()` after a successful sign-in / refresh, and cleared by `signOut()` or a failed silent refresh. **Presence of the marker proves nothing about cryptographic validity — only that the user recently authenticated.** The API is still the only authority.

## Adding a new protected segment

Edit `apps/webapp/src/middleware.ts`:

```ts
const PROTECTED_PREFIXES = ['/users', '/products', '/orders', '/payments'];
```

Append your new prefix. The matcher already covers all routes, so no other change is needed.

## Adding a new public prefix

`PUBLIC_PREFIXES = ['/auth', '/_next', '/api', '/favicon.ico']` — add new ones (e.g. `/legal`, `/about`) that should never redirect.

## Why we don't decode the JWT in middleware

1. The refresh token is `httpOnly` and scoped to a different origin — middleware cannot see it.
2. Even if it could, signature verification on the Edge requires shipping JWKS at request time or bundling public keys into the Edge function. The cost outweighs the benefit when the API will re-verify anyway.
3. The marker pattern keeps the Edge function fast and the security boundary unambiguous: **API = authority, Edge = UX optimization.**

## Removing the marker

```ts
// In AuthProvider:
clearSessionMarker(); // writes Max-Age=0
```

Always clear on:
- Successful sign-out
- 401 from `/auth/me` or `/auth/refresh-session`
- User-initiated session reset

## Configuration

```ts
config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

The negative lookahead skips Next.js asset paths so the middleware doesn't run on every CSS/JS chunk.
