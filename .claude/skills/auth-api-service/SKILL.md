---
name: auth-api-service
description: Implement or extend the authentication API service (apps/auth/auth-api-service/). Use when adding auth endpoints (sign-in, refresh, password flows) or modifying the JWT auth guard.
---

# Skill: auth-api-service

## When to use this skill

Use this skill when:
- Implementing or extending the authentication API service (`apps/auth/auth-api-service/`)
- Adding new auth endpoints (sign-in, refresh, password flows)
- Reviewing or modifying the JWT auth guard
- Wiring `LocalAuthProvider` or `CognitoAuthProvider`
- Implementing the `AuthProvider` in `client-common` (silent refresh, 401 retry)

---

## 1. Auth Service Architecture

The `auth-api-service` is a standalone NestJS service with no domain package. It delegates all auth operations to an `IAuthProvider` abstraction — `CognitoAuthProvider` in deployed environments and `LocalAuthProvider` locally.

```
AuthController
  └─ AuthApplicationService
       └─ IAuthProvider (abstract class)
            ├─ CognitoAuthProvider   (deployed: STAGE !== 'local')
            └─ LocalAuthProvider     (local: STAGE === 'local')
```

The service has no domain entities, no repository, and no DynamoDB/Prisma dependency. It is infrastructure-only.

---

## 2. IAuthProvider Interface

The `IAuthProvider` abstract class lives in `packages/aws/aws-cognito/src/auth-provider.interface.ts` and is implemented by both providers.

```typescript
// packages/aws/aws-cognito/src/auth-provider.interface.ts
export abstract class IAuthProvider {
  abstract signIn(email: string, password: string): Promise<SignInResult>;
  abstract newPassword(email: string, session: string, newPassword: string): Promise<SignInResult>;
  abstract refreshSession(refreshToken: string): Promise<RefreshResult>;
  abstract forgotPassword(email: string): Promise<void>;
  abstract confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>;
  abstract changePassword(accessToken: string, oldPassword: string, newPassword: string): Promise<void>;
  abstract signOut(accessToken: string): Promise<void>;
  abstract getUser(accessToken: string): Promise<AuthUserResult>;
}
```

---

## 3. LocalAuthProvider (Local Development)

`LocalAuthProvider` is used when `STAGE=local`. It requires no AWS credentials, no Cognito setup, and accepts a fixed credential:

```
Email:    admin@test.com
Password: Password123!
```

**Token format:**
- Access token: unsigned JWT with `sub`, `email`, `custom:role`, `iss`, `iat`, `exp` claims
- Refresh token: stateless string `local-refresh-{userId}-{timestamp}` (no DB lookup needed)

The local provider issues tokens that are accepted by the local `JwtAuthGuard` bypass (when `STAGE=local`, the guard does not verify signatures).

---

## 4. CognitoAuthProvider (Deployed)

Used when `STAGE !== 'local'`. Reads three env vars:

| Env var | Purpose |
|---|---|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_REGION` | AWS region (e.g., `eu-west-2`) |

Delegates calls to the AWS Cognito SDK (`@aws-sdk/client-cognito-identity-provider`).

---

## 5. Controller Endpoints

All endpoints are under the `/auth` prefix and the global `api` prefix, so the full path is `/api/auth/*`.

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/auth/sign-in` | ❌ | Sign in with email + password |
| `POST` | `/auth/new-password` | ❌ | Set new password (after first sign-in challenge) |
| `POST` | `/auth/refresh-session` | ❌ | Silent token refresh via httpOnly cookie |
| `POST` | `/auth/forgot-password` | ❌ | Send password reset code |
| `POST` | `/auth/confirm-forgot-password` | ❌ | Confirm reset with code + new password |
| `POST` | `/auth/change-password` | ✅ | Change password (authenticated) |
| `POST` | `/auth/sign-out` | ✅ | Sign out (revoke tokens) |
| `GET` | `/auth/me` | ✅ | Get current user details |
| `GET` | `/health` | ❌ | Health check |

All unauthenticated endpoints must use the `@Public()` decorator.

---

## 6. Cookie Setup (Critical — Read Carefully)

Refresh tokens must be set as httpOnly cookies. The cookie parameters differ by environment:

```typescript
// In AuthController.setRefreshCookie()
private setRefreshCookie(res: Response, refreshToken: string): void {
  const isLocal = process.env.STAGE === 'local';
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: !isLocal,
    sameSite: isLocal ? 'lax' : 'none',
  });
}
```

**Why `SameSite=None` in deployed mode?** The frontend (ALB, e.g. `app.example.com`) and the API Gateway (e.g. `api.execute-api.eu-west-2.amazonaws.com`) are on different origins. `SameSite=None` is the only setting that allows cross-site cookie sending. It requires `Secure=true` (HTTPS).

**Why `SameSite=Lax` locally?** The frontend and API are both on `localhost` — same site. Lax allows the cookie to be sent without requiring HTTPS.

> **Never use `SameSite=Strict` in deployed mode.** The browser will not send the cookie on cross-origin requests.

---

## 7. JWT Auth Guard (Per-Service Pattern)

Every API service gets its own copy of `JwtAuthGuard`. The guard is **not** a shared package — it lives in each service's `presentation/guards/` folder.

The guard reads three env vars:

| Env var | Local value | Deployed value |
|---|---|---|
| `JWT_JWKS_URI` | (ignored when STAGE=local) | Cognito JWKS endpoint or Auth0/Keycloak JWKS URI |
| `JWT_ISSUER` | (ignored when STAGE=local) | Token issuer claim (must match) |
| `JWT_USER_ID_CLAIM` | `sub` | `sub` for Cognito, `sub` for Auth0, configurable |

**Local bypass:** When `STAGE=local`, the guard skips JWKS verification and accepts any token that `LocalAuthProvider` issued. The token's payload is decoded without signature verification.

```typescript
// JwtAuthGuard — skeleton
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;

    // Local bypass
    if (process.env.STAGE === 'local') {
      const token = this.extractToken(request);
      request.user = this.decodeWithoutVerification(token);
      return true;
    }

    // Deployed: verify via JWKS
    const token = this.extractToken(request);
    request.user = await this.verifyViaJwks(token);
    return true;
  }
}
```

> **`request.user` is consumed via `@CurrentUser()`.** The guard's job is to populate `request.user = { userId, email, userRole? }`. Controllers MUST read it via the per-service `@CurrentUser()` decorator (Golden Rule #45) — never reach into `request.user` directly and never accept `userId`/`actorId` from `@Body()` or `@Query()`. See the `current-user-decorator` skill.

**Wire the guard in AppModule:**

```typescript
// AppModule providers
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
}
```

---

## 8. CORS Configuration

Every API service must enable CORS with credentials:

```typescript
// main.ts
app.enableCors({
  origin: process.env.FE_BASE_URL,
  credentials: true,
});
```

Never use `origin: '*'` with `credentials: true`.

---

## 9. Module Wiring (auth-api-service)

```typescript
// auth.module.ts
@Module({
  providers: [
    // Auth provider — switches based on STAGE
    {
      provide: IAuthProvider,
      useClass: process.env.STAGE === 'local' ? LocalAuthProvider : CognitoAuthProvider,
    },
    AuthApplicationService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
```

Import `IAuthProvider`, `LocalAuthProvider`, and `CognitoAuthProvider` from `@mma/aws-cognito`.

---

## 10. AuthProvider in client-common

The frontend `AuthProvider` (in `packages/client-common/src/lib/providers.tsx` or similar) handles:

1. **Silent refresh on mount** — calls `POST /auth/refresh-session` with `credentials: 'include'` to restore session from the httpOnly cookie.
2. **Access token memory storage** — stores the access token in React state only (lost on page refresh, restored by step 1).
3. **401 auto-retry** — when any API call returns 401, the base API client calls refresh and retries once before redirecting to login.
4. **Re-entrancy guard** — multiple concurrent 401s trigger only one refresh call.

```typescript
// AuthProvider pattern
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Silent refresh on mount
    fetch(`${getApiUrl('auth')}/auth/refresh-session`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => setAccessToken(data.accessToken))
      .catch(() => setAccessToken(null));
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, setAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 11. Env Vars Required

Add to `.env.local`:

```dotenv
AUTH_SERVICE_PORT=3003
API_AUTH_URL=http://localhost:3003/api
NEXT_PUBLIC_API_AUTH_URL=http://localhost:3003/api
EXPO_PUBLIC_API_AUTH_URL=http://localhost:3003/api

# Deployed only (not needed locally — LocalAuthProvider is used when STAGE=local)
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=eu-west-2
```

---

## 12. E2E Testing with Auth

E2E tests must sign in before calling protected endpoints:

```typescript
// global-setup.ts
const res = await fetch(`${process.env.API_AUTH_URL}/auth/sign-in`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
  credentials: 'include',
});
const { accessToken } = await res.json();
process.env.E2E_ACCESS_TOKEN = accessToken;
```

Use the access token in the `Authorization: Bearer {token}` header for subsequent requests.

---

## 13. Checklist When Modifying auth-api-service

- [ ] `IAuthProvider` method signatures match in both `LocalAuthProvider` and `CognitoAuthProvider`
- [ ] New endpoints use `@Public()` where auth is not required
- [ ] Cookie `sameSite`/`secure` flags respect `STAGE=local` check (not `NODE_ENV`)
- [ ] `APP_GUARD` → `JwtAuthGuard` is wired in `AppModule`
- [ ] `FE_BASE_URL` is used for CORS, not `'*'`
- [ ] Health endpoint uses `@Get('health')` + `@Public()` and returns `{ status: 'ok', service: 'auth-api-service' }`
- [ ] New endpoints documented with Swagger decorators (see `swagger-controller-docs` skill)
- [ ] Tests cover both happy path and error cases
