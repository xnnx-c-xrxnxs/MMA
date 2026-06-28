---
name: gateway-jwt-auth
description: Wire the API Gateway JWT authorizer for a service, declare public routes, and understand the two-tier (gateway + NestJS) auth model. Use this when adding a new HTTP API service, exposing a new public endpoint, or troubleshooting 401 responses on deployed environments.
---

# Skill: gateway-jwt-auth

## Why two tiers?

Every API service has **two independent JWT checks**:

| Tier | Where | Validates | Rejects with |
|---|---|---|---|
| **Edge (gateway)** | API Gateway HTTP API v2 JWT authorizer | Token signature, issuer, audience, expiry | `401 Unauthorized` BEFORE Lambda is invoked |
| **NestJS** | `JwtAuthGuard` in each service | Same as above + extracts `request.user = {userId, email, userRole}` | `401` from inside Lambda |

Both must allow the request. The gateway-side check is a hard perimeter — no Lambda invocation cost for unauthenticated traffic, no DDoS amplification. The NestJS check populates `request.user` so `@CurrentUser()` works.

## When this skill applies

- Adding a new HTTP API service (must declare its public routes — `/api/health` minimum, plus `/api/swagger`, `/api/swagger-json`, and `/api/swagger/{proxy+}` if Swagger is shipped).
- Adding a new endpoint that should bypass JWT auth (sign-in, password-reset, public webhooks).
- Removing a `@Public()` decorator (must remove the matching registry entry too).
- Diagnosing `401 Unauthorized` returned by API Gateway with no Lambda log entry.

## Hard rules

1. **The registry is the source of truth for the gateway.** `.github/service-registry.json` → `gatewayAuth.publicRoutes` is what Terraform reads. The `@Public()` decorator alone is NOT enough — the gateway will still reject.
2. **Counts must match.** Every `@Public()` decorator in a service's controllers needs an entry in `gatewayAuth.publicRoutes` for that service (and vice-versa, minus the 3 Swagger paths). Enforced by the `gateway-public-routes-sync` lint check.
3. **Paths use the gateway-side URL** AFTER the `/{domain}` prefix is stripped — i.e. exactly what NestJS sees. Always begin with `/api/...`.
4. **Public routes ≠ unauthenticated logic.** A `@Public()` route can still call `@CurrentUser('userId')` IF the upstream caller passed a token (e.g. health checks from authenticated monitoring). It just doesn't *require* a token. If your endpoint must read the actor, do not mark it public.
5. **`/api/swagger`, `/api/swagger-json`, AND `/api/swagger/{proxy+}` must all be public** for the Swagger UI to load — even when Swagger itself is gated by `SWAGGER_ENABLED`. The `{proxy+}` entry is what lets the Swagger UI static bundle (`swagger-ui-bundle.js`, CSS, icons) load through the gateway. The gateway doesn't know whether the service actually serves the route; it only routes URLs. Public-route entries to non-existent endpoints return 404, never 401, which is harmless.

## Step 1 — Add @Public() to the controller

```typescript
import { Public } from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('sign-in')
  async signIn(@Body() body: SignInDto) { ... }
}
```

## Step 2 — Register in `.github/service-registry.json`

```json
{
  "gatewayAuth": {
    "enabled": true,
    "publicRoutes": [
      { "service": "auth-api-service", "method": "POST", "path": "/api/auth/sign-in" },
      ...
    ]
  }
}
```

The `path` is the path NestJS sees — so a controller decorated `@Controller('auth')` with `@Post('sign-in')` and the global prefix `api` produces the path `/api/auth/sign-in`.

## Step 3 — Standard public routes for every new HTTP API service

When you scaffold a new service, seed these entries (the lint check expects them):

```json
{ "service": "{name}", "method": "GET", "path": "/api/health" },
{ "service": "{name}", "method": "GET", "path": "/api/swagger" },
{ "service": "{name}", "method": "GET", "path": "/api/swagger-json" },
{ "service": "{name}", "method": "GET", "path": "/api/swagger/{proxy+}" }
```

`/api/health` is required because:
- The CD smoke test hits `{base-url}/health` after deployment and expects `200`.
- Without it being public, the smoke test fails with `401` and the deploy is rolled back.

The three `/api/swagger*` entries are required even when `SWAGGER_ENABLED` is unset — the gateway has no way to introspect Lambda env vars, and unused gateway routes return harmless `404`s. The `{proxy+}` entry is essential: without it, the Swagger UI's JS/CSS bundle requests (`/api/swagger/swagger-ui-bundle.js`, etc.) are rejected with `401` and the docs page renders blank.

## Step 4 — Verify with the lint check

```powershell
pnpm lint:standards
```

The `gateway-public-routes-sync` check counts `@Public()` decorators per service and compares them to `publicRoutes` entries (minus 3 for the always-required Swagger routes: `/api/swagger`, `/api/swagger-json`, `/api/swagger/{proxy+}`). A mismatch fails CI before merge.

## Step 5 — How Terraform applies this

`infra/modules/api-gateway/main.tf` creates one JWT authorizer per environment using Cognito JWKS:

```hcl
resource "aws_apigatewayv2_authorizer" "jwt" {
  count            = var.jwt_authorizer.enabled ? 1 : 0
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = var.jwt_authorizer.audience  # = [cognito.client_id]
    issuer   = var.jwt_authorizer.issuer    # = https://cognito-idp.{region}.amazonaws.com/{pool_id}
  }
}
```

`infra/modules/lambda-api/main.tf` creates two route patterns per service:

```hcl
# JWT-protected catch-all
resource "aws_apigatewayv2_route" "proxy" {
  route_key          = "ANY /${var.domain}/{proxy+}"
  authorization_type = var.jwt_authorizer_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.jwt_authorizer_id != "" ? var.jwt_authorizer_id : null
}

# Public bypass — one route per public_routes entry
resource "aws_apigatewayv2_route" "public" {
  for_each           = { for r in var.public_routes : "${r.method} ${r.path}" => r }
  route_key          = "${each.value.method} /${var.domain}${each.value.path}"
  authorization_type = "NONE"
}
```

Per-route `authorization_type = "NONE"` overrides the catch-all because more-specific routes win.

## Cross-service propagation

When Service A (with a JWT) calls Service B via an ACL adapter, Service A must spread `...getOutboundHeaders()` (from `@old-st/telemetry`) into the outbound headers. This forwards both `Authorization: Bearer ...` and `x-correlation-id`, so Service B's JWT guard sees the same token and `@CurrentUser()` resolves to the same actor. See the `sync-cross-service-call` skill and Golden Rule #46.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` from API Gateway with NO Lambda log entry | Missing entry in `publicRoutes` for an endpoint that should be public |
| `401` from inside Lambda (you see the request log) | NestJS guard rejecting — token is past expiry, wrong issuer, or `JwtAuthGuard` not wired |
| `200` but `request.user` is undefined | Endpoint is `@Public()` but caller didn't send a token. Either remove `@Public()` or guard `@CurrentUser()` with optional access |
| Swagger UI loads but every "Try it out" returns 401 | Expected — Swagger is public; the API endpoints behind it are not. Click "Authorize" and paste a valid Bearer token |
| New endpoint works locally but 401s in dev | Forgot to update `publicRoutes` in the registry, then ran Terraform apply |

## Disabling gateway-side auth (escape hatch)

For preview environments where Cognito isn't fully wired, set `gatewayAuth.enabled = false` in the registry. The catch-all route falls back to `authorization_type = "NONE"` and only NestJS guards apply. Never do this for staging or prod.
