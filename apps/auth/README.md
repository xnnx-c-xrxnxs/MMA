# auth-api-service

Authentication API for the platform. Pluggable provider — defaults to AWS Cognito in deployed environments and `LocalAuthProvider` (mock JWT, fixed credentials) for local dev / CI.

## Endpoints

| Method | Path | Public? | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/sign-in` | ✅ | Email + password → access token (memory) + refresh cookie (httpOnly) |
| `POST` | `/api/auth/refresh-session` | ✅ | Reads httpOnly refresh cookie → new access token |
| `POST` | `/api/auth/sign-out` | 🔒 | Clears refresh cookie |
| `GET`  | `/api/auth/me` | 🔒 | Returns current user from JWT |
| `POST` | `/api/auth/forgot-password` | ✅ | Triggers password reset email |
| `POST` | `/api/auth/confirm-forgot-password` | ✅ | Confirms reset with code + new password |
| `POST` | `/api/auth/new-password-required` | ✅ | First-login flow (Cognito) |
| `GET`  | `/api/health` | ✅ | Liveness probe |

✅ = `@Public()` (bypasses JWT guard) · 🔒 = requires `Authorization: Bearer <token>`

## Local dev

Default port: **3003** (`AUTH_SERVICE_PORT`). Base URL: `http://localhost:3003/api`.

```sh
# Start everything
pnpm nx serve auth-api-service

# Or via VS Code task: "Service: Serve auth-api-service"
```

Local credentials (issued by `LocalAuthProvider`): `admin@test.com` / `Password123!`

## Auth model (golden rules)

- **Refresh tokens are httpOnly cookies** — never readable from JS (Golden Rule #24).
- **Access tokens are memory-only** — restored on page load via silent refresh (Golden Rule #25).
- **All API calls include `credentials: 'include'`** so the browser sends the refresh cookie (Golden Rule #26).
- **CORS allows credentials** — `origin` is set to `FE_BASE_URL`, never `*` (Golden Rule #27).
- **Provider-agnostic JWT guard** — reads `JWT_JWKS_URI`, `JWT_ISSUER`, `JWT_USER_ID_CLAIM` from env (Golden Rule #28). Bypassed when `STAGE=local`.

See the **[auth-api-service skill](../../.claude/skills/auth-api-service/SKILL.md)** for adding new auth flows or swapping the provider.

## Environment variables

| Variable | Purpose |
|---|---|
| `AUTH_SERVICE_PORT` | HTTP port (default 3003) |
| `STAGE` | `local` enables `LocalAuthProvider` |
| `FE_BASE_URL` | CORS origin + cookie domain inference |
| `COGNITO_USER_POOL_ID` | Deployed environments only |
| `COGNITO_CLIENT_ID` | Deployed environments only |
| `COGNITO_REGION` | Deployed environments only |
| `JWT_JWKS_URI` | JWKS endpoint for token verification |
| `JWT_ISSUER` | Expected issuer claim |
| `JWT_USER_ID_CLAIM` | Claim holding the user ID (`sub` for Cognito) |

## Tests

```sh
pnpm nx test auth-api-service       # unit + integration
pnpm nx e2e auth-api-service-e2e    # API E2E (if present)
```

## See also

- [contracts/auth](../../packages/contracts/auth/) — Zod schemas for sign-in, refresh, password flows
- [packages/aws/aws-cognito](../../packages/aws/aws-cognito/) — `IAuthProvider` interface + Cognito + Local impls
- [CLAUDE.md §Auth Rules](../../CLAUDE.md)
