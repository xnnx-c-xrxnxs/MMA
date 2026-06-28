# Code Review Guidelines

> Judgment-based review standards for this Clean Architecture template — the criteria a
> reviewer (human, or an AI review pass such as Claude Code's `/code-review`) checks that
> automated lint/structural rules cannot. Customize per project.

---

## Review Priority

When reviewing a PR, check for violations in this order (highest priority first):

1. **Security** — injection, secrets in code, unvalidated input
2. **Architecture violations** — layer boundary breaks, wrong dependency direction
3. **Import violations** — bare contracts imports, cross-domain leaks, Prisma in domain
4. **Business logic** — missing guard conditions, hardcoded strings, wrong state transitions
5. **API design** — REST conventions, error shapes, missing validation
6. **Testing** — missing tests for new logic, inadequate coverage
7. **Style** — naming, file placement, barrel exports

---

## Architecture Standards (Flag as "must fix")

### Clean Architecture Boundaries

- **Controllers must never call use cases directly.** They go through Application Services.
  - Bad: `controller → CreateUserUseCase`
  - Good: `controller → UserApplicationService → CreateUserUseCase`

- **Application Services must always exist** between controllers and use cases, even for simple pass-through operations.

- **Use Cases return domain entities**, not DTOs. The Application Service transforms entities to DTOs using `schema.parse()`.

- **Domain layer has zero framework dependencies.** Files in `domain/entities/`, `domain/constants/`, `domain/exceptions/` must not import from `@nestjs/*`, `zod`, `express`, `@prisma/client`, or `@mma/contracts/*`.

- **Infrastructure layer has no business logic.** Repositories implement interfaces — all business decisions live in entities and use cases.

### Entity Patterns

- **Entities must have a private constructor.** Construction happens via `create()` (new) and `reconstitute()` (from DB) static factories.

- **Entities must not have `toObject()` methods.** Serialization is handled by the Application Service → Zod `schema.parse()` pipeline.

- **Entity timestamps must be `dateCreated` + `updatedAt` only.** Never add `createdAt` — OneTable manages that at the persistence level.

- **All fields must be private.** Immutable fields use `private readonly`. Access is via getters only.

- **`reconstitute()` does no validation** — it trusts persisted data.

### Domain Constants

- **Never hardcode status/role strings** like `'PENDING'`, `'ACTIVE'`, `'USER'`, `'ADMIN'`. Always use the domain enum constant (e.g., `UserStatusEnum.ACTIVE`).

- **Domain constants are the single source of truth.** Prisma schema enums must mirror them exactly.

### Never Trust Client Input

- **Never accept userId from the request body** for authorization-sensitive operations. Derive it from the authentication context.

---

## Import Rules (Flag as "must fix")

- **Never import from bare `@mma/contracts`** — always use domain-scoped subpaths: `@mma/contracts/{domain}` (or `@mma/contracts/common`).

- **Use cases must not import from `@mma/contracts/*`.** Use case inputs are primitive types only.

- **Cross-domain event consumers import from contracts only** (`@mma/contracts/{publishing-domain}`), never from the publishing domain's package (`@mma/{domain}-domain`).

- **`@prisma/client` is banned outside `infrastructure/repositories/`.** Domain and application layers never touch it.

- **Frontend components must not call `fetch()` or import `axios` directly.** Use `@mma/client-common` hooks and API clients.

---

## API Design (Flag as "should fix")

### REST Conventions

- Plural nouns for collections: `/users`, `/orders`, `/products` — never singular.
- Kebab-case, lowercase only in paths — never camelCase or snake_case.
- No verbs in resource names: `/users/:id/activate` (correct), `/activateUser` (wrong).
- State transitions use `POST` sub-resource: `POST /users/:id/activate`.
- Field-level updates use `PATCH`: `PATCH /users/:id/role`.
- Filters go in query parameters, not path segments.

### HTTP Status Codes

- `201 Created` for resource creation (not `200`).
- `204 No Content` for successful delete (not `200`).
- `400` for validation errors.
- `404` for not found.
- `409` for conflict (already exists, wrong state).

### Error Response Shape

All error responses must use this exact shape — no `timestamp` field:
```json
{ "statusCode": 409, "error": "CannotActivateDeletedUserError", "message": "Cannot activate a deleted user" }
```

### Validation

- Every controller with `@Body()` or `@Query()` params must use `ZodValidationPipe`.
- Every `@Body()` must have a matching `@ApiBody` Swagger decorator.
- Every controller method must have `@ApiInternalServerErrorResponse`.

---

## Persistence Patterns (Flag as "should fix")

### Pagination Consistency

- **DynamoDB domains** use cursor-based pagination (`IPaginatedResponse`).
- **Prisma domains** use offset-based pagination (`IOffsetPaginatedResponse`).
- **Never mix** pagination styles within a single domain.

### DynamoDB

- `get()` is for primary key lookup only. Use `find()` for any GSI query.
- `find()` calls **must** include the `index` parameter (omitting it silently returns wrong data).
- `toDomain()` and `toPersistence()` must be private methods.

### Prisma

- Import `PrismaClient` from the domain's generated client path, not from `@prisma/client`.
- Use `$transaction` for aggregate saves (e.g., order with items).
- Cascade delete is handled by the Prisma schema — repository calls `delete()` on the root only.

---

## Event-Driven Patterns (Flag as "must fix")

- **All domain events must be handled by a dedicated event-handler-service.** Never handle SQS/event logic inside HTTP API services.

- **Saga handlers must be idempotent.** Check the entity status before transitioning; if already resolved, log and skip — do not rethrow.

- **Event publishing happens in the use case**, not the application service.

- **Queue naming follows consumer-owned inbox pattern:** `{consuming-domain}-events`.

---

## File Operations (Flag as "must fix" when applicable)

- **All file uploads and downloads must be routed through the dedicated file-api-service** (when present in the project). Other domain services must not directly use S3, multer, or file stream operations.

---

## Frontend Patterns (Flag as "should fix")

### Webapp (Next.js)

- **Pages are thin orchestrators** — they wire hooks, state, and child components. No table or form markup in page files.
- **Domain components live in `components/{domain}/`**, not in the page file.
- **UI primitives come from `@mma/ui`** — never use raw HTML `<table>`, `<button>`, `<input>`.
- **Status badge mapping uses enum constants** from `@mma/contracts/{domain}`, not hardcoded strings.

### Mobile (Expo)

- **Screens are thin orchestrators** — same principle as webapp pages.
- **Use `FlatList` for lists**, never `ScrollView` + `.map()`.
- **Use `StyleSheet.create()`** for all non-trivial styles — no inline style objects.
- **UI primitives come from `@mma/mobile-ui`** — never raw `View`/`Text` for interactive elements.

### Shared Data Layer

- **Webapp and mobile share the same hooks and API clients** from `@mma/client-common`. Never create mobile-only or webapp-only API clients.
- **API client responses must be Zod-parsed** — every `apiRequest()` call passes a `schema` option.

---

## Testing (Flag as "should fix")

- **Domain entities and use cases always need tests.** Check for new logic without corresponding test updates.
- **Application services always need tests** if they have orchestration logic (cursor routing, DTO mapping, event publishing).
- **Event handler services always need tests** (dispatcher routing + individual handlers).
- **Coverage thresholds:** domain packages ≥ 80%, service apps ≥ 70%, frontend ≥ 70%.
- **No `it.skip` / `xit` / `test.only` without explanation** in committed code.

---

## Infrastructure (Flag as "should fix")

- **`STAGE === 'local'` is the only check for local-vs-cloud branching.** Never use `NODE_ENV === 'development'`.
- **Each HTTP API service uses `{DOMAIN}_SERVICE_PORT`**, not the generic `PORT` variable.
- **New services must be registered in** `.vscode/tasks.json`, `.github/service-registry.json`, and `.github/service-registry.env`.
- **Every `src/` subfolder should have an `index.ts` barrel export.**
- *`.env.local.example` must be updated** when new environment variables are introduced.

---

## Deployment & Terraform (Flag as "should fix")

### Service Registry

- **`service-registry.json` must include full deployment metadata for new services.** Every API or worker service entry must have `name`, `distPath`, `domain`, `type`, `handler`, `memorySize`, `timeout`, and `envVars`. Missing fields will cause Terraform failures.
- **New infrastructure resources** (DynamoDB tables, SQS queues, RDS PostgreSQL databases, S3 buckets) **must be added to `infrastructure`** section in `service-registry.json` — never hardcoded in `.tf` files.
- **If a service needs VPC access** (e.g., for RDS/Prisma), `requiresVpc: true` must be set in the registry entry.
- **Worker services must include `sqsQueueRef`** pointing to the `envVar` of the SQS queue they consume from.

### Terraform Conventions

- **Never hardcode service names, table names, queue names, or env vars in Terraform.** All resource creation must iterate over `service-registry.json` data via `for_each`.
- **Terraform modules must not be edited for routine service additions.** If a PR modifies `.tf` files only to add a new service (not a new resource type), it indicates the data-driven pattern was bypassed.
- **All Terraform changes must be reviewed via `cd-infra-plan.yml` output.** PRs changing `infra/**` or `service-registry.json` trigger automatic plan — reviewers must check the plan output in PR comments.
- **Preview environments must not create per-developer Terraform files.** One parameterized `infra/environments/preview/` directory serves all previews.

### Webapp Docker

- **The webapp Dockerfile must use the `standalone` Next.js output.** Verify that `next.config.js` includes `output: 'standalone'`.
- **New `NEXT_PUBLIC_*` env vars must be added to both** `service-registry.json` → `webapp.envVars` AND the Dockerfile `ARG`/`ENV` block.

### Security

- **Never store AWS credentials as GitHub secrets.** CD workflows must use GitHub OIDC (`aws-actions/configure-aws-credentials@v4` with `role-to-assume`).
- **Secrets Manager secrets must not contain hardcoded passwords.** Use `random_password` resources in Terraform.

---

## Authentication & Security Patterns (Flag as "must fix")

### Refresh Tokens

- **Refresh tokens must be httpOnly cookies.** The auth-api-service must set `Set-Cookie` with `httpOnly: true`, `path: '/'`.
- **SameSite value is environment-dependent:**
  - Local (`STAGE=local`): `SameSite=Lax; Secure=false`
  - Deployed: `SameSite=None; Secure=true` — required for cross-origin (API Gateway ↔ frontend ALB). Never use `SameSite=Strict` in deployed mode.
- **Never store refresh tokens in `localStorage`, `sessionStorage`, or JavaScript `memory`.**

### Access Tokens

- **Access tokens must be memory-only** — never persisted to storage. Lost on page refresh and restored via silent refresh (`POST /auth/refresh-session`).
- **All API calls must include `credentials: 'include'`** so the browser sends the httpOnly refresh cookie. This is handled automatically by the base API client.

### CORS

- **CORS must use a specific `origin`**, not `'*'`, when `credentials: true` is set. Use `process.env.FE_BASE_URL`.

### JWT Auth Guard

- **Every HTTP API service wires `APP_GUARD` → `JwtAuthGuard`.** No service may accept unauthenticated requests without an explicit `@Public()` decorator.
- **The guard is provider-agnostic** — it reads `JWT_JWKS_URI`, `JWT_ISSUER`, and `JWT_USER_ID_CLAIM` env vars. Locally (`STAGE=local`), the guard is bypassed.
- **Locally, the `LocalAuthProvider` is used** — no Cognito dependency. Credentials: `admin@test.com` / `Password123!`.

---

## Structural Code Standards (Flag as "must fix")

These are enforced by `scripts/lint-standards.ts` (runs in CI via `ci-fast-check.yml`).

| Check | Rule |
|---|---|
| `entity-no-toObject` | Entities must not have `toObject()` methods |
| `entity-uses-enum-constants` | Entity methods must not hardcode status/role strings |
| `no-bare-contracts-import` | Imports must use subpath (`@mma/contracts/{domain}`) |
| `no-createdAt-in-entities` | Entities use `dateCreated`, not `createdAt` |
| `no-node-env-development` | Code must check `STAGE`, not `NODE_ENV`, for local mode |
| `controller-no-direct-usecase` | Controllers must call application services, not use cases |
| `domain-no-nestjs-imports` | Domain layer must not import from `@nestjs/*` |
| `prisma-client-infra-only` | Only `infrastructure/repositories/` may import from `@prisma/client` |
| `service-registry-env-sync` | Env vars referenced in module code must be declared in both registry files |

---

## Per-Project Customization

Projects created from this template can:
- **Add sections** for project-specific standards (e.g., auth patterns, logging conventions).
- **Remove sections** that don't apply (e.g., mobile rules if the project has no mobile app).
- **Adjust severity** — change "must fix" to "should fix" during migration periods.
- **Add domain-specific rules** — e.g., "all payment operations must use the payment-gateway-service".

