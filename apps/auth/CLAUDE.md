# Auth Service Context

This file is automatically loaded when working on any file inside `apps/auth/` or `packages/contracts/auth/`. It provides the exact current state of the auth service so Claude Code starts with full context.

---

## What This Service Does

`auth-api-service` is a **singleton service** — it has no domain package. It delegates all authentication operations to an `IAuthProvider` implementation:
- **Local (`STAGE=local`):** `LocalAuthProvider` — accepts `admin@test.com` / `Password123!`, issues unsigned mock JWTs. No Cognito needed.
- **Deployed:** `CognitoAuthProvider` — AWS Cognito User Pool + App Client via AWS SDK.

The service issues **access tokens** (short-lived, memory-only in frontend) and **refresh tokens** (long-lived, httpOnly cookie only).

---

## Ports & Environment Variables

| Variable | Local value | Purpose |
|---|---|---|
| `AUTH_SERVICE_PORT` | `3003` | HTTP listen port |
| `STAGE` | `local` | Controls provider selection |
| `COGNITO_USER_POOL_ID` | (empty locally) | AWS Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | (empty locally) | AWS Cognito App Client ID |
| `COGNITO_REGION` | `eu-west-2` | Cognito region |
| `JWT_JWKS_URI` | — | JWKS endpoint for token verification in other services |
| `JWT_ISSUER` | — | Expected issuer claim |
| `JWT_USER_ID_CLAIM` | `sub` | Claim name holding the user ID |
| `JWT_USER_ROLE_CLAIM` | — | Claim name holding the user role |
| `FE_BASE_URL` | `http://localhost:4200` | CORS allowed origin |

---

## API Endpoints

**Base path:** `/api` | **Port:** `3003`

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/auth/sign-in` | No (`@Public()`) | Sign in with email + password. Returns access token + sets httpOnly refresh cookie |
| `POST` | `/auth/refresh-session` | No (`@Public()`) | Silent refresh using httpOnly cookie. Returns new access token |
| `POST` | `/auth/sign-out` | No (`@Public()`) | Clears the refresh cookie |
| `POST` | `/auth/forgot-password` | No (`@Public()`) | Initiate password reset flow |
| `POST` | `/auth/confirm-forgot-password` | No (`@Public()`) | Confirm password reset with code |
| `POST` | `/auth/new-password` | No (`@Public()`) | Set new password (first-login challenge) |
| `POST` | `/auth/change-password` | No (`@Public()`) | Change password (authenticated) |
| `GET` | `/auth/me` | Yes | Return current user info from token claims |
| `GET` | `/health` | No (`@Public()`) | Health check → `{ status: 'ok', service: 'auth-api-service' }` |

---

## Cookie Strategy

| Environment | `Secure` | `SameSite` | Reason |
|---|---|---|---|
| Local (`STAGE=local`) | `false` | `Lax` | Same-origin localhost; browser allows non-secure cookie |
| Deployed | `true` | `None` | Frontend (ALB) and API Gateway are on different origins; `SameSite=None` with `Secure` is required for cross-origin cookies |

The refresh token is **always** in an httpOnly cookie — **never** in the response body or localStorage.

---

## JWT Guard Pattern

Every other API service copies the `JwtAuthGuard` from this service. The guard reads three env vars:
- `JWT_JWKS_URI` — JWKS endpoint for public key verification
- `JWT_ISSUER` — validated against the `iss` claim
- `JWT_USER_ID_CLAIM` — which claim holds the user ID (defaults to `sub` for Cognito)

**Local bypass:** When `STAGE=local`, the guard accepts unsigned mock tokens issued by `LocalAuthProvider` without JWKS verification.

**Public endpoints:** Decorated with `@Public()` to bypass the guard. Always use `@Public()` on health endpoints and unauthenticated auth flows.

---

## IAuthProvider Interface

**File:** `packages/aws/aws-cognito/src/auth-provider.interface.ts`

Methods:
- `signIn(email, password)` → access token + challenge metadata
- `refreshSession(refreshToken)` → new access token
- `initiatePasswordReset(email)`
- `confirmPasswordReset(email, code, newPassword)`
- `setNewPassword(email, session, newPassword)` — first-login challenge
- `changePassword(accessToken, oldPassword, newPassword)`
- `signOut(accessToken)`
- `getUserFromToken(accessToken)` → user claims

---

## Contracts

**Import path:** `@old-st/contracts/auth` — never bare `@old-st/contracts`

**File:** `packages/contracts/auth/src/schemas.ts`

Schemas include: `signInInputSchema`, `refreshSessionResponseSchema`, `forgotPasswordInputSchema`, `confirmForgotPasswordInputSchema`, `newPasswordInputSchema`, `changePasswordInputSchema`, discriminated union response schemas for sign-in (success vs challenge).

---

## Files in This Service

```
apps/auth/auth-api-service/src/
  application/services/auth-application.service.ts   ← delegates to IAuthProvider
  infrastructure/config/jwt.config.ts                ← JwtConfig (reads env vars)
  modules/auth.module.ts                             ← wires LocalAuthProvider or CognitoAuthProvider
  presentation/
    controllers/auth.controller.ts
    filters/domain-exception.filter.ts
    guards/jwt-auth.guard.ts
    decorators/public.decorator.ts
    pipes/zod-validation.pipe.ts
```

---

## Enforced Rules

24. **Refresh tokens must be httpOnly cookies — never localStorage or JS memory.** Set-Cookie uses `httpOnly`, `path: '/'`, and env-specific `Secure`/`SameSite` (see Cookie Strategy table above). Frontend code cannot read the refresh token.
25. **Access tokens are memory-only — lost on page refresh, restored via silent refresh.** `AuthProvider` in `client-common` calls `POST /auth/refresh-session` on mount with `credentials: 'include'` to restore the session from the httpOnly cookie.
26. **All API calls must include `credentials: 'include'`** so the browser sends the httpOnly refresh cookie. The base API client in `@old-st/client-common` sets this automatically — do not strip it.
27. **CORS must allow credentials when using cookie-based refresh.** All backend services use `app.enableCors({ origin: process.env.FE_BASE_URL, credentials: true })`. Never use `origin: '*'` with `credentials: true`.
28. **Every API service has its own JWT auth guard — provider-agnostic.** Guards are per-service copies reading `JWT_JWKS_URI`, `JWT_ISSUER`, and `JWT_USER_ID_CLAIM`. Locally bypassed when `STAGE=local` (unsigned mock tokens from `LocalAuthProvider`). Use `@Public()` to exempt auth-free endpoints. Wire `APP_GUARD` → `JwtAuthGuard`.
29. **Local auth uses `LocalAuthProvider` — no Cognito dependency in development or CI.** Accepts `admin@test.com` / `Password123!` and issues mock JWTs. E2E tests authenticate via `POST /auth/sign-in` before protected calls.

---

## Skills to Use

| Task | Skill |
|---|---|
| Implement or extend the auth service | `auth-api-service` |
| Add a new auth endpoint | `add-api-endpoints` |
| Add Swagger docs | `swagger-controller-docs` |
| Update auth contracts / Zod schemas | `add-contracts` |
| Replicate the JWT guard in a new service | `nestjs-service-layers` (§ JWT Guard section) |
