````skill
---
name: swagger-controller-docs
description: Add industry-standard OpenAPI/Swagger documentation to any NestJS controller. Use this when a controller is missing Swagger decorators, when a new controller is created, or when existing docs need updating. Covers bootstrap setup, controller tags, operation summaries, response schemas, query/path/body parameter descriptions, enum handling, pagination response shapes, and the shared schema const pattern. Since this codebase uses Zod (not class-validator DTOs), all schema descriptions use the shared-const + raw schema approach with 'type:  object as const'. Every controller must have @ApiInternalServerErrorResponse on every method, @ApiBody on every @Body() param, and @ApiQuery with required:true+enum for status/role filter params.
---

# Adding Swagger / OpenAPI Docs to a NestJS Controller

NestJS Swagger docs: https://docs.nestjs.com/openapi/introduction

---

## Root Cause — Why This Matters

In this codebase controllers use **Zod schemas** (`z.infer<T>`) for body
validation. Zod types are TypeScript-only — they are erased at runtime,
so NestJS reflection sees `@Body() body: SignInInput` as `Object`. The
Swagger UI renders body / query / path input fields **only** when the
OpenAPI document declares them via explicit `@ApiBody` / `@ApiQuery` /
`@ApiParam` decorators with `schema: { type: 'object' as const, ... }`.

**Without these decorators every operation in the OpenAPI document is
empty.** Swagger UI's "Try it out" panel shows ONLY an Execute button —
no body editor, no query inputs, no path field. Forked projects then
ship broken-looking API docs.

This is enforced by the `swagger-decorators-required` lint check in
[scripts/lint-standards.ts](../../../scripts/lint-standards.ts) (run by
`ci-fast-check.yml`). The check requires:

- `@ApiTags(...)` on every `@Controller(...)` class.
- `@ApiOperation({ summary: '...' })` on every route handler.
- `@ApiBody(...)` whenever a handler reads `@Body()`.
- `@ApiQuery({ name: '...' })` for every `@Query('name')` parameter.
- `@ApiParam({ name: '...' })` for every `@Param('name')` parameter.

---

## 0. Pre-Requisites — Read First

1. **Read the controller** you are documenting before writing any decorators.
2. **Read the relevant domain exceptions** so you can document all error response codes accurately.
3. **Read the contracts** (`packages/contracts/{domain}/src/schemas.ts`) to understand what the request/response shapes look like.
4. Because this codebase uses **Zod schemas** for validation instead of class DTOs decorated with `@ApiProperty()`, all body and response schemas MUST be described using the raw `schema:` approach inside `@ApiBody()` and `@ApiResponse()` decorators. **Do not add `@ApiProperty()` to Zod schemas — it will not work.**

---

## 1. Package Installation (If Missing)

```bash
pnpm add @nestjs/swagger --filter <service-name>
```

Verify it appears in the service `package.json` dependencies, not devDependencies.

---

## 2. Bootstrap — `main.ts`

Swagger bootstrapping is handled inside `createSwaggerConfig()` and the `bootstrapServer()` / `bootstrapLambda()` functions scaffolded by the `nestjs-service-layers` skill. **Do not add a separate Swagger setup** — it is already wired in the dual-mode `main.ts` template.

Key details from the `main.ts` template relevant to controller documentation:

```typescript
// In createSwaggerConfig() — already in generated main.ts
builder.addBearerAuth(
  {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    name: 'JWT',
    description: 'Enter JWT token',
    in: 'header',
  },
  'JWT-auth',   // ← this is the security name referenced in @ApiBearerAuth('JWT-auth')
);

// SwaggerModule is setup with useGlobalPrefix: true
// → Swagger UI is at /api/swagger (not /swagger or /api)
SwaggerModule.setup('swagger', nestApp, document, { useGlobalPrefix: true });
```

**Rules:**
- Swagger UI is exposed at `/api/swagger` (not `/api` or `/swagger`) because `useGlobalPrefix: true` and the path `'swagger'` are combined with `setGlobalPrefix('api')`.
- The security scheme name is `'JWT-auth'` — use `@ApiBearerAuth('JWT-auth')` on any JWT-protected controller class or method.
- The `addBearerAuth` call in `main.ts` already registers the scheme globally; you only need `@ApiBearerAuth('JWT-auth')` on the routes that require it.
- There is no `operationIdFactory` override in the current pattern; operation IDs default to NestJS method-name format.
- If the service does not yet have `@nestjs/swagger` installed, run:
  ```bash
  pnpm add @nestjs/swagger --filter {service-name}
  ```
  and verify it is in `dependencies` (not `devDependencies`) in the service `package.json`.

---

## 3. Controller-Level Decorators

Place these on the controller class, immediately above `@Controller(...)`.

```typescript
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')      // Groups all routes under this tag in Swagger UI
@Controller('users')
export class UserController { ... }
```

**Rules:**
- Tag name must match the plural resource name used in the route (`users`, `products`, `orders`).
- Only one `@ApiTags()` per controller.
- Tags are collected automatically by Swagger from `@ApiTags()` decorators — there is no `.addTag()` call in `main.ts`.

---

## 4. Method-Level: `@ApiOperation()`

Every route handler MUST have an `@ApiOperation()` decorator.

```typescript
import { ApiOperation } from '@nestjs/swagger';

@Post()
@ApiOperation({
  summary: 'Create a new user',
  description: 'Creates a user with PENDING status. Email must be unique.',
})
createUser(...) { ... }
```

**Rules:**
- `summary` is a single short sentence (shown in collapsed view).
- `description` explains preconditions, constraints, or domain rules — use it for anything that is not obvious from the summary.
- Never leave `summary` empty.

---

## 5. Response Decorators

Use the shorthand decorators. Import them from `@nestjs/swagger`.

### Quick Reference Table

| HTTP Status | Scenario | Decorator |
|---|---|---|
| `200 OK` | Success with body | `@ApiOkResponse({ description, schema })` |
| `201 Created` | Resource created | `@ApiCreatedResponse({ description, schema })` |
| `204 No Content` | Success, no body | `@ApiNoContentResponse({ description })` |
| `400 Bad Request` | Input validation failed (Zod error) | `@ApiBadRequestResponse({ description })` |
| `404 Not Found` | Entity not found | `@ApiNotFoundResponse({ description })` |
| `409 Conflict` | Domain invariant violation (wrong state, duplicate) | `@ApiConflictResponse({ description })` |
| `500 Internal Server Error` | Unexpected error | `@ApiInternalServerErrorResponse({ description })` |

### Mapping Exceptions to Response Decorators

Each method MUST document every error code that can be realistically thrown. Use the domain exception list from the domain package to determine which codes apply.

| Exception class pattern | HTTP code | Decorator |
|---|---|---|
| `InvalidInputError`, `ValidationError` | 400 | `@ApiBadRequestResponse` |
| `UserNotFoundError`, `{Entity}NotFoundError` | 404 | `@ApiNotFoundResponse` |
| `UserAlreadyExistsError`, `{Entity}AlreadyExistsError`, `InvalidStatusTransitionError` | 409 | `@ApiConflictResponse` |

### Response Schema — Single Entity (Zod-based)

Always reference the shared schema const (defined per section 10) rather than inlining. If you must show the shape for documentation purposes:

```typescript
// Prefer this — reference the shared const defined near top of file
@ApiOkResponse({ description: 'User found', schema: userResponseSchema })

// Only acceptable when the const does not yet exist (fix it before finishing)
@ApiOkResponse({
  description: 'User found',
  schema: {
    type: 'object' as const,     // ← 'as const' REQUIRED
    properties: {
      userId:     { type: 'string', example: 'usr_01HX4ABCDE' },
      email:      { type: 'string', format: 'email', example: 'alice@example.com' },
      firstName:  { type: 'string', example: 'Alice' },
      lastName:   { type: 'string', example: 'Smith' },
      userRole:   { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
      userStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], example: 'ACTIVE' },
      dateCreated: { type: 'string', format: 'date-time' },
      updatedAt:  { type: 'string', format: 'date-time' },
    },
    required: ['userId', 'email', 'firstName', 'lastName', 'userRole', 'userStatus', 'dateCreated', 'updatedAt'],
  },
})
```

### Response Schema — Paginated List (Cursor-Based — DynamoDB Domains)

Reference the paginated schema const. The const must use `type: 'object' as const` on both the wrapper and nested item schema.

```typescript
// Prefer this — reference the shared const
@ApiOkResponse({ description: 'Paginated list of users', schema: paginatedUsersResponseSchema })

// Shape for reference only
// paginatedUsersResponseSchema = {
//   type: 'object' as const,
//   properties: {
//     items: { type: 'array', items: userResponseSchema },
//     nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6...' },
//     prevCursorPointer: { type: 'string', nullable: true, example: null },
//   },
//   required: ['items'],
// };
```

### Response Schema — Paginated List (Offset-Based — Prisma Domains)

Prisma-based domains use offset pagination with `total`, `page`, `limit`, `totalPages` metadata instead of cursor pointers.

```typescript
// Prefer this — reference the shared const
@ApiOkResponse({ description: 'Paginated list of orders', schema: paginatedOrdersResponseSchema })

// Shape for reference only
// paginatedOrdersResponseSchema = {
//   type: 'object' as const,
//   properties: {
//     data:       { type: 'array', items: orderResponseSchema },
//     total:      { type: 'number', example: 42 },
//     page:       { type: 'number', example: 1 },
//     limit:      { type: 'number', example: 20 },
//     totalPages: { type: 'number', example: 3 },
//   },
//   required: ['data', 'total', 'page', 'limit', 'totalPages'],
// };
```

**Rules:**
- Always include `nextCursorPointer` and `prevCursorPointer` in DynamoDB cursor-based paginated responses — they match the repository contract.
- Always include `total`, `page`, `limit`, `totalPages` in Prisma offset-based paginated responses — they match the `IOffsetPaginatedResponse` contract.
- Use `nullable: true` for cursor fields (they can be `null` when there are no more pages).
- Offset-based fields (`total`, `page`, `limit`, `totalPages`) are never nullable.
- Use `data` (not `items`) as the array field name for offset-based responses to match `IOffsetPaginatedResponse`.
- Enum values MUST match the domain constants exactly — verify against `packages/{domain}-domain/src/domain/constants/`.

---

## 6. Query Parameter Decorators — `@ApiQuery()`

Add one `@ApiQuery()` per query key. Place them on the method, above or below `@ApiOperation()`.

```typescript
import { ApiQuery } from '@nestjs/swagger';

@Get()
@ApiOperation({ summary: 'Get user by email' })
@ApiQuery({ name: 'email', required: true, description: 'Email address to look up', example: 'alice@example.com' })
getUserByEmail(...) { ... }
```

### Enum Query Params (role / status)

```typescript
@ApiQuery({
  name: 'userStatus',
  required: true,
  enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'],  // ← must match UserStatusEnum values
  description: 'Filter users by status',
})
@ApiQuery({
  name: 'userRole',
  required: true,
  enum: ['USER', 'ADMIN', 'MODERATOR'],                   // ← must match UserRoleEnum values
  description: 'Filter users by role',
})
```

### Pagination Query Params (Cursor-Based — DynamoDB Domains)

Declare these once per paginated endpoint, not as a shared type (no class DTOs):

```typescript
@ApiQuery({ name: 'limit',     required: false, type: Number, description: 'Page size (1-100)', example: 20 })
@ApiQuery({ name: 'cursor',    required: false, type: String, description: 'Opaque pagination cursor' })
@ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
```

### Pagination Query Params (Offset-Based — Prisma Domains)

```typescript
@ApiQuery({ name: 'page',  required: false, type: Number, description: 'Page number (1-based, default: 1)', example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100, default: 20)', example: 20 })
```

**Rules:**
- `required: true` for all mandatory query params (status, role, email lookups).
- `required: false` for optional params (cursor, limit, direction).
- Always add `example:` so the Swagger UI allows try-out without manual input.

---

## 7. Path Parameter Decorators — `@ApiParam()`

Add one `@ApiParam()` per route path parameter.

```typescript
import { ApiParam } from '@nestjs/swagger';

@Get(':userId')
@ApiOperation({ summary: 'Get user by ID' })
@ApiParam({ name: 'userId', description: 'The user UUID', example: 'usr_01HX...' })
getUserById(...) { ... }
```

**Rules:**
- `name` must exactly match the path parameter name in the route decorator (`:userId` → `name: 'userId'`).
- Always include `example:` with a realistic-looking value.

---

## 8. Request Body Decorator — `@ApiBody()`

Since bodies are validated by Zod pipes (not class DTOs), use the raw `schema:` approach.

### Create / Update body example

```typescript
import { ApiBody } from '@nestjs/swagger';

@Post()
@ApiOperation({ summary: 'Create a new user' })
@ApiBody({
  description: 'User creation payload',
  schema: {
    type: 'object' as const,     // ← 'as const' REQUIRED
    properties: {
      email:     { type: 'string', format: 'email', example: 'alice@example.com' },
      firstName: { type: 'string', example: 'Alice' },
      lastName:  { type: 'string', example: 'Smith' },
      userRole:  { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER', description: 'Defaults to USER if omitted' },
    },
    required: ['email', 'firstName', 'lastName'],   // ← list every non-optional field
  },
})
createUser(...) { ... }
```

### Update role body example

```typescript
@ApiBody({
  description: 'New role for the user',
  schema: {
    type: 'object' as const,     // ← 'as const' REQUIRED
    properties: {
      userRole: { type: 'string', enum: ['USER', 'ADMIN'], example: 'ADMIN' },
    },
    required: ['userRole'],
  },
})
```

**Rules:**
- `type: 'object' as const` is **always required** — omitting `as const` causes a TypeScript error.
- `required` array must list every Zod non-optional field exactly — derive it from the contract schema.
- Enum values must match domain constants exactly — derive them from `@old-st/contracts` or the domain package.
- Add a `description` to enum fields and optional fields to guide developers in Swagger UI.
- Do NOT reference a DTO class in `type:` — only raw inline schemas or `schema:` consts.

---

## 9. Action Endpoints (No Body, No Response Body)

For state-change sub-resources (activate, deactivate, verify-email):

```typescript
@Post(':userId/activate')
@ApiOperation({
  summary: 'Activate a user',
  description: 'Transitions user from INACTIVE or PENDING to ACTIVE.',
})
@ApiParam({ name: 'userId', description: 'The user UUID', example: 'usr_01HX4ABCDE' })
@ApiOkResponse({ description: 'User successfully activated', schema: userResponseSchema })
@ApiNotFoundResponse({ description: 'User not found' })
@ApiConflictResponse({ description: 'User is already active or cannot transition from current status' })
@ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
activateUser(...) { ... }
```

> The `@ApiInternalServerErrorResponse` decorator is **required** on action endpoints just like every other route.

---

## 10. Shared Schema Const Pattern — Required

Define the entity response shape and the paginated wrapper **once** as constants near the top of the controller file and reuse them in every response decorator. This avoids duplication and keeps enum values consistent.

Two TypeScript rules apply here:

1. The `type` field must be typed as a literal: write `type: 'object' as const` or TypeScript infers `string` and the Swagger module rejects it at compile time.
2. `nullable: true` must be set on any field that can be `null` in the response (e.g. cursor pointers).

```typescript
// ── Near top of controller file ───────────────────────────────────────────────
const userResponseSchema = {
  type: 'object' as const,           // ← 'as const' is required
  properties: {
    userId:     { type: 'string', example: 'usr_01HX4ABCDE' },
    email:      { type: 'string', format: 'email', example: 'alice@example.com' },
    userRole:   { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
    userStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], example: 'ACTIVE' },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:  { type: 'string', format: 'date-time' },
  },
  required: ['userId', 'email', 'userRole', 'userStatus', 'dateCreated', 'updatedAt'],
};

const paginatedUsersResponseSchema = {
  type: 'object' as const,           // ← 'as const' is required
  properties: {
    items:             { type: 'array', items: userResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6...' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['items'],
};
```

### Offset-Based Pagination Variant (Prisma Domains)

For Prisma-based domains, define an offset-paginated schema const using `data` instead of `items`:

```typescript
const paginatedOrdersResponseSchema = {
  type: 'object' as const,           // ← 'as const' is required
  properties: {
    data:       { type: 'array', items: orderResponseSchema },
    total:      { type: 'number', example: 42 },
    page:       { type: 'number', example: 1 },
    limit:      { type: 'number', example: 20 },
    totalPages: { type: 'number', example: 3 },
  },
  required: ['data', 'total', 'page', 'limit', 'totalPages'],
};
```

**Rules:**
- Always use `type: 'object' as const` — never `type: 'object'` without `as const`.
- Enum values must be string literal arrays matching the domain constants exactly.
- Define one `{entity}ResponseSchema` and one `paginated{Entities}ResponseSchema` per entity.
- Never inline the schema object directly inside `@ApiOkResponse()` — always reference the const.

---

## 11. Complete Annotated Example — `UserController`

Below is the full pattern for reference. Every route follows this exact structure:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

// ── Shared schema consts (define once near top of controller file) ────────────
// 'as const' is REQUIRED on 'type' — TypeScript needs a string literal, not string
const userResponseSchema = {
  type: 'object' as const,
  properties: {
    userId:     { type: 'string', example: 'usr_01HX4ABCDE' },
    email:      { type: 'string', format: 'email', example: 'alice@example.com' },
    firstName:  { type: 'string', example: 'Alice' },
    lastName:   { type: 'string', example: 'Smith' },
    userRole:   { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
    userStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], example: 'ACTIVE' },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:  { type: 'string', format: 'date-time' },
  },
  required: ['userId', 'email', 'firstName', 'lastName', 'userRole', 'userStatus', 'dateCreated', 'updatedAt'],
};

const paginatedUsersResponseSchema = {
  type: 'object' as const,
  properties: {
    items:             { type: 'array', items: userResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6...' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['items'],
};

@ApiTags('users')
@Controller('users')
export class UserController {

  @Get('by-status')
  @ApiOperation({ summary: 'List users by status', description: 'Returns a paginated list of users filtered by status.' })
  @ApiQuery({ name: 'userStatus', required: true,  enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], description: 'Filter by user status' })
  @ApiQuery({ name: 'limit',      required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'cursor',     required: false, type: String })
  @ApiQuery({ name: 'direction',  required: false, enum: ['next', 'prev'], example: 'next' })
  @ApiOkResponse({ description: 'Paginated user list', schema: paginatedUsersResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listUsersByStatus(...) { ... }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({
    description: 'User creation payload',
    schema: {
      type: 'object' as const,
      properties: {
        email:     { type: 'string', format: 'email', example: 'alice@example.com' },
        firstName: { type: 'string', example: 'Alice' },
        lastName:  { type: 'string', example: 'Smith' },
        userRole:  { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
      },
      required: ['email', 'firstName', 'lastName'],   // ← list every non-optional field
    },
  })
  @ApiCreatedResponse({ description: 'User created', schema: userResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createUser(...) { ... }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX...' })
  @ApiOkResponse({ description: 'User found', schema: userResponseSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getUserById(...) { ... }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX...' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteUser(...) { ... }
}
```

---

## 12. Checklist Before Finishing

### Controller class
- [ ] `@ApiTags('{entities}')` on the controller class (plural noun, matches route prefix)

### Every route method
- [ ] `@ApiOperation({ summary, description })` — `summary` is never empty
- [ ] Success response decorator: `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiNoContentResponse` with `schema:` referencing the shared const
- [ ] `@ApiInternalServerErrorResponse({ description: 'Unexpected server error' })` — **required on every single route method without exception**
- [ ] `@ApiBadRequestResponse` on every method that accepts a `@Body()` or a required/typed `@Query()`
- [ ] `@ApiNotFoundResponse` on every method that looks up an entity by ID or email
- [ ] `@ApiConflictResponse` on every method that enforces domain uniqueness or state transition invariants

### Parameters
- [ ] `@ApiParam` for every `:param` segment in the route path
- [ ] `@ApiQuery` for every `@Query()` parameter
  - Status / role filter params: `required: true` + `enum: [...]` + `description`
  - Pagination params (cursor-based: `limit`, `cursor`, `direction`): `required: false` + `example`
  - Pagination params (offset-based: `page`, `limit`): `required: false` + `example`
- [ ] `@ApiBody` for every `@Body()` parameter using raw inline `schema:`
  - `type: 'object' as const` — never `type: 'object'` (TypeScript literal required)
  - `required: [...]` array listing every non-optional field
  - Enum fields use `enum: [...]` array matching domain constants exactly

### Schema consts
- [ ] `{entity}ResponseSchema` const defined near top of file with `type: 'object' as const`
- [ ] `paginated{Entities}ResponseSchema` const defined near top of file for every paginated endpoint:
  - **Cursor-based (DynamoDB):** uses `items`, `nextCursorPointer`, `prevCursorPointer`
  - **Offset-based (Prisma):** uses `data`, `total`, `page`, `limit`, `totalPages`
- [ ] Enum values in all schema consts match domain constants exactly (verify against `packages/{domain}-domain/src/domain/constants/`)
- [ ] `nullable: true` on every field that can be `null` (e.g., cursor pointers)
- [ ] No inline schema objects in response decorators — always reference the shared const
````
