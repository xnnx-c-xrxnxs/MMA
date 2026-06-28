---
name: add-api-endpoints
description: Design and implement REST API endpoints in a NestJS controller. Use this when adding new routes, reviewing existing routes, or designing the API surface for a new domain. Enforces industry-standard REST conventions and the specific patterns used in this codebase.
---

# Adding API Endpoints

Architecture reference: Section 5 of `CLAUDE.md`

> **Swagger is mandatory.** Every controller created or modified by this skill must be fully documented using the `swagger-controller-docs` skill. Read that skill file before writing any controller. A controller without Swagger decorators is considered incomplete.

> **Authenticated actor — Golden Rule #45.** Any endpoint that needs the caller's identity (audit logs, ownership checks, mutations that record `createdBy`) MUST read it via `@CurrentUser()` from the per-service decorator at `presentation/decorators/current-user.decorator.ts`. NEVER take `userId`, `actorId`, `performedBy`, or `requesterId` from `@Body()` or `@Query()` — that is the canonical broken-access-control bug, and the `no-userId-in-controller-input` lint check will block the PR. Path parameters like `:userId` are allowed when they identify the *subject* of an admin action; the actor still comes from the JWT. See the `current-user-decorator` skill for full patterns.

---

## Resource Naming Rules

| Rule | Correct | Wrong |
|---|---|---|
| Use plural nouns | `/users`, `/orders`, `/products` | `/user`, `/getUsers` |
| Use kebab-case for multi-word | `/order-items`, `/role-assignments` | `/orderItems`, `/order_items` |
| Lowercase only | `/users` | `/Users` |
| No verbs in resource names | `/users/:id/activate` | `/activateUser` |

---

## HTTP Verb Table

| Intent | Method | Example | Status Code |
|---|---|---|---|
| Create resource | `POST` | `POST /users` | `201 Created` |
| Read collection | `GET` | `GET /users` | `200 OK` |
| Read single resource | `GET` | `GET /users/:userId` | `200 OK` |
| Full replace | `PUT` | `PUT /users/:userId` | `200 OK` |
| Partial update | `PATCH` | `PATCH /users/:userId` | `200 OK` |
| Delete | `DELETE` | `DELETE /users/:userId` | `204 No Content` |
| Trigger action/state change | `POST` | `POST /users/:userId/activate` | `200 OK` |

---

## Path Parameters vs Query Strings

| Use case | Where it goes | Example |
|---|---|---|
| Identity / lookup by ID | Path param | `GET /users/:userId` |
| Filtering by attribute | Query param | `GET /users?status=active` |
| Sorting | Query param | `GET /orders?sortBy=dateCreated` |
| Pagination cursor + limit (DynamoDB) | Query param | `GET /users?cursor=abc&limit=20&direction=next` |
| Pagination page + limit (Prisma) | Query param | `GET /orders?page=1&limit=20` |
| Search text | Query param | `GET /products?q=keyboard` |

**Never put filter values in the path.** `/users/active` is wrong. `/users?status=active` is correct.

Exception: structural sub-resource access backed by a dedicated GSI is acceptable: `/users/by-status?status=active`.

---

## State-Changing Actions — Sub-Resource Pattern

State transitions and actions use `POST` with a verb sub-resource:

```typescript
// Correct
POST /users/:userId/activate
POST /users/:userId/deactivate
POST /users/:userId/verify-email

// Wrong
PATCH /users/:userId/status        ← use PATCH only for field updates, not state transitions
GET  /users/:userId/activate       ← actions are never GET
PUT  /users/:userId                ← do not use PUT for partial state change
```

Field-level updates use `PATCH`:
```typescript
PATCH /users/:userId               ← update profile fields
PATCH /users/:userId/role          ← update a single nested attribute
```

---

## Response Status Codes

| Scenario | Code | NestJS decorator |
|---|---|---|
| Resource created | `201 Created` | `@HttpCode(HttpStatus.CREATED)` |
| Success with body | `200 OK` | (default) |
| Success, no body (delete) | `204 No Content` | `@HttpCode(HttpStatus.NO_CONTENT)` |
| Validation error | `400 Bad Request` | thrown by `ZodValidationPipe` |
| Not found | `404 Not Found` | thrown by `{Entity}NotFoundError` → `DomainExceptionFilter` |
| Conflict (duplicate, wrong state) | `409 Conflict` | thrown by domain exception → `DomainExceptionFilter` |
| Internal error | `500 Internal Server Error` | default fallback in `DomainExceptionFilter` |

---

## Versioning

- Prefix all publicly exposed or cross-client routes with `/v1/`: e.g. `@Controller('v1/users')`
- Internal service-to-service APIs within the monorepo may omit versioning.

---

## NestJS Static Route Ordering — Critical

NestJS matches routes in declaration order. Static paths must be declared **before** dynamic `/:param` routes, or they will be captured by the dynamic handler first.

```typescript
@Controller('users')
export class UserController {

  // ── STATIC PATHS — declare first ──────────────────────────────────────────
  @Get('by-status')
  listUsersByStatus(@Query(...) query) { ... }

  @Get('by-role-and-status')
  listUsersByRoleAndStatus(@Query(...) query) { ... }

  @Get()                                 // GET /users?email=
  getUserByEmail(@Query(...) query) { ... }

  // ── DYNAMIC /:userId PATHS — declare after all static paths ───────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body(...) body) { ... }

  @Get(':userId')                        // must come after all static GET routes
  getUserById(@Param('userId') id: string) { ... }

  @Patch(':userId')
  updateUser(...) { ... }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(...) { ... }

  @Post(':userId/activate')
  activateUser(@Param('userId') id: string) { ... }
}
```

---

## `ZodValidationPipe` Usage

Apply `ZodValidationPipe` directly to the parameter decorator. Create local query schemas per route when coercion is needed.

```typescript
// Body validation (z.number() is fine — JSON handles type conversion)
@Post()
createUser(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {}

// Query validation — z.coerce.number() for numeric params
// DynamoDB domains — cursor-based:
const listByStatusQuerySchema = z.object({
  userStatus: userStatusSchema,
  limit: z.coerce.number().min(1).max(100).optional().default(20),  // coerce!
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

// Prisma domains — offset-based:
const listByStatusQuerySchema = z.object({
  orderStatus: orderStatusSchema,
  page: z.coerce.number().min(1).optional().default(1),            // coerce!
  limit: z.coerce.number().min(1).max(100).optional().default(20), // coerce!
});

@Get('by-status')
listByStatus(@Query(new ZodValidationPipe(listByStatusQuerySchema)) query) {}

// Param validation
@Get(':userId')
getById(@Param(new ZodValidationPipe(getUserByIdSchema)) params: GetUserByIdInput) {}
```

**Key rule:** query parameters always arrive as strings from HTTP. Use `z.coerce.number()` for any numeric query param. Using `z.number()` will fail since `"20"` is not a number.

---

## DTO Boundary Rule

Controllers must **never** return or receive domain entities. Only DTOs (types from `@mma/contracts`) cross the presentation boundary.

```typescript
// Correct: controller returns what the application service returns (a DTO)
@Get(':userId')
getUserById(@Param('userId') id: string): Promise<UserResponse> {
  return this.userApplicationService.getUserById(id);  // service returns DTO
}

// Wrong: controller must never call a use case directly
@Get(':userId')
getUserById(@Param('userId') id: string) {
  return this.getUserByIdUseCase.execute(id);  // returns domain entity — forbidden
}
```

---

## User Service Route Reference

The complete user service route table as a reference for new services:

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/users` | Create user | 201 |
| `GET` | `/users?email=` | Lookup by email | 200 |
| `GET` | `/users/by-status?status=&cursor=&direction=` | List by status | 200 |
| `GET` | `/users/by-role-and-status?role=&status=&cursor=&direction=` | List by role+status | 200 |
| `GET` | `/users/:userId` | Get single user | 200 |
| `PATCH` | `/users/:userId` | Update profile | 200 |
| `DELETE` | `/users/:userId` | Delete | 204 |
| `POST` | `/users/:userId/activate` | Activate | 200 |
| `POST` | `/users/:userId/deactivate` | Deactivate | 200 |
| `POST` | `/users/:userId/verify-email` | Verify email | 200 |
| `PATCH` | `/users/:userId/role` | Update role | 200 |

---

## Swagger Annotation Obligation

Every endpoint added or modified by this skill **must** be annotated before the task is considered complete. Use the `swagger-controller-docs` skill for the full rules.

> **Why this is non-negotiable:** controllers in this codebase use Zod (`z.infer<T>`) for body validation. Zod types are erased at runtime, so NestJS reflection sees `@Body() body: SignInInput` as `Object` and the OpenAPI document emits an empty operation. Swagger UI's "Try it out" panel then shows ONLY the Execute button — no body editor, no query inputs, no path field — and forks ship broken-looking API docs. Enforced by the `swagger-decorators-required` lint check in `scripts/lint-standards.ts` (CI blocker).

Minimum per method:

| What you added | Required Swagger decorator(s) |
|---|---|
| Any route method | `@ApiOperation({ summary })` + success response decorator + `@ApiInternalServerErrorResponse` |
| `@Body()` parameter | `@ApiBody({ schema: { type: 'object' as const, properties: {...}, required: [...] } })` |
| `@Query()` enum param (status, role) | `@ApiQuery({ name, required: true, enum: [...], description })` |
| `@Query()` pagination param | `@ApiQuery({ name, required: false, ... })` |
| `@Param()` path segment | `@ApiParam({ name, description, example })` |
| Entity lookup by ID | `@ApiNotFoundResponse` |
| Body or required query | `@ApiBadRequestResponse` |
| State transition / uniqueness | `@ApiConflictResponse` |
