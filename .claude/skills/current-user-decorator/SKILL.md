---
name: current-user-decorator
description: Read the authenticated actor (userId, email, userRole) from the JWT in a controller via the per-service @CurrentUser() decorator. Use this when adding any controller endpoint that needs to know who the caller is — for audit logs, ownership checks, mutations that record createdBy/updatedBy, or to pass the actor identity into an application service. Always use this instead of reading userId/email from @Body(), @Query(), or @Param() (Golden Rule #45).
---

# current-user-decorator

## When to use this skill

Read it whenever you are:

- Adding a new controller endpoint that needs the authenticated actor's identity.
- Refactoring a controller to remove `userId`/`actorId`/`performedBy` from `@Body()` or `@Query()` (broken access control).
- Wiring audit-log fields (`createdBy`, `updatedBy`, `lastModifiedBy`) — these MUST come from `@CurrentUser()`.
- Adding a `GET /me` style endpoint that returns data for the calling user.

## What ships with every API service

Every service under `apps/{domain}/{service}/` has the following two files (copies — not a shared package, mirroring the per-service `JwtAuthGuard` convention):

| File | Purpose |
|---|---|
| `src/presentation/decorators/current-user.decorator.ts` | Exports `CurrentUser` (param decorator) and `AuthenticatedUser` (the typed shape of `request.user`) |
| `src/presentation/types/express.d.ts` | Augments `Express.Request` so `request.user?: AuthenticatedUser` is typed everywhere |

The `JwtAuthGuard` (also per-service) populates `request.user = { userId, email, userRole? }` after a successful JWT verification. `@Public()` routes do not have `request.user` populated — never use `@CurrentUser()` on a public endpoint.

## How to use it

### 1. Inject the full user object

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../decorators/current-user.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderApplicationService) {}

  @Post()
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
  ) {
    // `user.userId` came from the JWT — NEVER from body
    return this.orderService.create({ ...body, customerId: user.userId });
  }
}
```

### 2. Inject a single field

```ts
@Get('me')
async me(@CurrentUser('userId') userId: string) {
  return this.userService.getById(userId);
}
```

### 3. Combine with `:userId` path param for admin actions

When the route operates on a different user (admin lookup, role change), the path param is the **subject**; the JWT actor is still the **performer**:

```ts
@Patch(':userId/role')
async changeRole(
  @CurrentUser() actor: AuthenticatedUser,                  // who is doing it
  @Param('userId') subjectUserId: string,                   // who it is being done to
  @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
) {
  return this.userService.changeRole(subjectUserId, body.role, actor.userId);
}
```

The application service then records `actor.userId` as the audit trail field.

## Hard rules (enforced by lint)

The `no-userId-in-controller-input` check in `scripts/lint-standards.ts` (run by `ci-fast-check.yml`) rejects any controller that reads:

- `actorId`
- `performedBy`
- `requesterId`
- `currentUserId`

…from `@Body()` or `@Query()`. Always use `@CurrentUser()` instead.

> **Note:** `:userId` in `@Param()` is permitted — it identifies the *subject* of an admin action, not the actor. The actor must still come from the JWT.

## Cross-service propagation

When your application service makes an outbound HTTP call to another bounded context via an ACL adapter, the adapter must spread `...getOutboundHeaders()` from `@mma/telemetry` into the outbound headers. This forwards the originating `Authorization` header so the downstream service's `@CurrentUser()` resolves to the same actor end-to-end. See the `sync-cross-service-call` skill.

## Adding the decorator to a new service

When scaffolding a new HTTP API service, copy the two files from any existing service (`presentation/decorators/current-user.decorator.ts` and `presentation/types/express.d.ts`). They are 100% identical across services — only the file location differs. The `nestjs-service-layers` skill already includes this step in its scaffolding template.

## Testing

A controller spec that uses `@CurrentUser()` should pass an `AuthenticatedUser` object directly when invoking the controller method (since param decorators are bypassed in unit tests):

```ts
const user: AuthenticatedUser = { userId: 'u1', email: 'a@b.com', userRole: 'USER' };
await controller.createOrder(user, { items: [...] });
expect(orderService.create).toHaveBeenCalledWith({ items: [...], customerId: 'u1' });
```

For E2E tests, the JWT issued by `LocalAuthProvider` carries the `sub` claim that `JwtAuthGuard` reads — no special test setup is needed beyond authenticating via `POST /auth/sign-in`.

## Related rules and skills

- **Golden Rule #10** — Never trust userId from client input.
- **Golden Rule #45** — Always read the actor via `@CurrentUser()`.
- **Golden Rule #46** — ACL adapters forward `Authorization` via `getOutboundHeaders()`.
- `auth-api-service` — How `JwtAuthGuard` is wired and what it populates on `request.user`.
- `sync-cross-service-call` — How to forward the actor across an ACL boundary.
- `gateway-jwt-auth` — How API Gateway pre-validates JWTs at the edge.
