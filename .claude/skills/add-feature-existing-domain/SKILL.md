---
name: add-feature-existing-domain
description: Step-by-step checklist for adding a new feature (endpoint, use case, or business rule) to an existing domain and service. Use this when extending user-domain, order-domain, product-domain, or any other existing domain package with new functionality.
---

# Adding a Feature to an Existing Domain

Use this skill when a domain and service already exist and you need to add a new capability — a new endpoint, business rule, state transition, or query.

---

## Required Information — Ask First

Before writing any code, confirm:

1. **What is the new capability?** (e.g. "suspend a user", "list orders by customer", "apply a discount to a product")
2. **Which domain?** (`user-domain`, `order-domain`, `product-domain`, etc.)
3. **Which service?** (`user-api-service`, `order-api-service`, etc.)
4. **Does this need a new query pattern?** (requires a new GSI or a new `find()` call)
5. **Does this change entity state?** (requires a new entity method + new exception)
6. **What are the input fields and output shape?** (required for contracts)
7. **Is this a collection endpoint?** (requires pagination)
8. **Does this feature require validation against another bounded context?** (e.g. validate customer exists before creating an order → follow `sync-cross-service-call` skill)
9. **Does this feature need to publish events for other domains to react to?** (→ follow `sqs-event-publisher` skill)
10. **Does this feature need to react to events from another domain?** (→ follow `cross-domain-event-handler` skill)

---

## Ordered Implementation Steps

Work through these layers **in order** — inner layers must be ready before outer layers consume them.

---

### Step 1 — Contracts Package

File: `packages/contracts/{domain}/src/schemas.ts`

Add or extend Zod schemas for any new input and output shapes:

```typescript
// New input schema
export const suspend{Entity}Schema = z.object({
  reason: z.string().min(1).max(500),
});
export type Suspend{Entity}Input = z.infer<typeof suspend{Entity}Schema>;

// New response additions (or new response schema if shape changes)
export const {entity}SuspendedResponseSchema = z.object({
  {entity}Id: z.string(),
  status: {entity}StatusSchema,
  suspendedAt: z.string(),
});
export type {Entity}SuspendedResponse = z.infer<typeof {entity}SuspendedResponseSchema>;
```

Update barrel exports in `packages/contracts/{domain}/src/index.ts`.

---

### Step 2 — Domain Layer (if entity behavior changes)

Only do this step if the feature involves new business rules or state changes.

**2a. Update constants if a new status/role is added:**
File: `packages/{domain}-domain/src/domain/constants/{entity}.constants.ts`

```typescript
export enum {Entity}StatusEnum {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',  // ← new
}
```

**2b. Add entity method + guard:**
File: `packages/{domain}-domain/src/domain/entities/{entity}.entity.ts`

```typescript
suspend(reason: string): void {
  if (this.status === {Entity}StatusEnum.SUSPENDED) {
    throw new {Entity}AlreadySuspendedError(this.{entity}Id);
  }
  this.status = {Entity}StatusEnum.SUSPENDED;
  this.suspendedAt = new Date();
  this.suspensionReason = reason;
}
```

**2c. Add domain exception if the guard needs one:**
File: `packages/{domain}-domain/src/domain/exceptions/{entity}-already-suspended.error.ts`

```typescript
export class {Entity}AlreadySuspendedError extends Error {
  constructor(id: string) {
    super(`{Entity} ${id} is already suspended`);
    this.name = '{Entity}AlreadySuspendedError';
  }
}
```

Update `packages/{domain}-domain/src/domain/exceptions/index.ts` barrel.
Update `packages/{domain}-domain/src/index.ts` barrel to export the new exception.

---

### Step 3 — Use Case

File: `packages/{domain}-domain/src/application/use-cases/suspend-{entity}/suspend-{entity}.use-case.ts`

```typescript
import { IUseCase } from '../interfaces/use-case.interface';
import { I{Entity}Repository } from '../interfaces/{entity}-repository.interface';
import { {Entity} } from '../../domain/entities/{entity}.entity';
import { {Entity}NotFoundError } from '../../domain/exceptions';

export class Suspend{Entity}UseCase implements IUseCase<{ {entity}Id: string; reason: string }, {Entity}> {
  constructor(private readonly {entity}Repository: I{Entity}Repository) {}

  async execute(input: { {entity}Id: string; reason: string }): Promise<{Entity}> {
    const {entity} = await this.{entity}Repository.findById(input.{entity}Id);
    if (!{entity}) {
      throw new {Entity}NotFoundError(input.{entity}Id);
    }
    {entity}.suspend(input.reason);   // entity method enforces the rule
    return this.{entity}Repository.save({entity});
  }
}
```

Update `packages/{domain}-domain/src/application/use-cases/index.ts` and `packages/{domain}-domain/src/index.ts`.

---

### Step 3a — Cross-Service Validation (only if feature depends on another bounded context)

**Skip this step** if the feature operates entirely within its own domain.

If the use case needs to validate an entity from another service (e.g. validate customer exists before creating an order):

1. Follow the **`sync-cross-service-call`** skill to define the ACL interface, exceptions, adapter, and module wiring.
2. Inject the ACL validator into the use case alongside the repository (see `new-use-case` skill, "Use Case with ACL Dependency" section).
3. Register ACL exceptions in the domain exception filter (Step 9).

If the feature publishes events for other domains, follow the **`sqs-event-publisher`** skill.
If the feature reacts to events from another domain, follow the **`cross-domain-event-handler`** skill.

---

### Step 4 — Repository Interface (only if new query needed)

Add new method signature only if the feature requires a query that doesn't exist yet.

**DynamoDB domains** use cursor-based pagination (`IPaginatedResponse`):
```typescript
abstract findByStatus(status: string, options: PaginationOptions): Promise<IPaginatedResponse<{Entity}>>;
```

**Prisma domains** use offset-based pagination (`IOffsetPaginatedResponse`):
```typescript
abstract findByStatus(status: string, page?: number, limit?: number): Promise<IOffsetPaginatedResponse<{Entity}>>;
```

Do not mix pagination styles within a single domain.

---

### Step 5 — Repository Implementation (only if interface changed)

**DynamoDB domains:** `packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.ts`
Implement the new method. Follow the `dynamo-repository` skill for GSI selection and pagination patterns.

**Prisma domains:** `packages/{domain}-domain/src/infrastructure/repositories/prisma-{entity}.repository.ts`
Implement the new method. Follow the `prisma-repository` skill for offset pagination (`skip`/`take` + `count()`) patterns.

---

### Step 5a — Update Infrastructure (if persistence schema changed)

**DynamoDB domains:** If Step 5 introduced a **new GSI** to the DynamoDB schema (new index in `{Entity}Schema.ts`),
or if an existing GSI was removed, update `scripts/setup-localstack.ts` accordingly.
Follow the instructions in the **Update LocalStack Setup Script** section of the `new-dynamo-schema` skill.

Quick checklist:
- [ ] New GSI? → add attribute to `attributeDefinitions` + add entry to `gsis` in the table config.
- [ ] Removed GSI? → remove from `gsis` + prune any now-unused attributes from `attributeDefinitions`.
- [ ] Apply: `pnpm run localstack:setup:force`

**Prisma domains:** If Step 5 added a new index or changed the schema, run:
```bash
pnpm prisma:{domain}:migrate:dev
```
No LocalStack changes are needed for Prisma domains.

> **Skip this step** if the feature only adds/modifies non-indexed fields or changes business logic only.

---

### Step 6 — Application Service

File: `apps/{domain}/{service}/src/application/services/{entity}-application.service.ts`

Add a method for the new feature:

```typescript
async suspend{Entity}(input: Suspend{Entity}Input): Promise<{Entity}Response> {
  const entity = await this.suspend{Entity}UseCase.execute({
    {entity}Id: input.{entity}Id,
    reason: input.reason,
  });
  return this.toDto(entity);
}
```

Add the new use case to the constructor:

```typescript
constructor(
  // ... existing
  private readonly suspend{Entity}UseCase: Suspend{Entity}UseCase,
) {}
```

---

### Step 7 — Controller Route + Swagger Annotations

File: `apps/{domain}/{service}/src/presentation/controllers/{entity}.controller.ts`

Add the new route following REST conventions (see `add-api-endpoints` skill). Every new route **must** immediately also have its full Swagger annotations — use the `swagger-controller-docs` skill for the exact rules. A route without Swagger decorators is incomplete.

Minimum required decorators per new route:

```typescript
@Post(':{entity}Id/suspend')
@ApiOperation({ summary: 'Suspend {entity}', description: 'Transitions {entity} to SUSPENDED status.' })
@ApiParam({ name: '{entity}Id', description: '{Entity} UUID', example: '{prefix}_01HX4ABCDE' })
@ApiBody({                               // ← required if there is a @Body() param
  description: 'Suspension reason',
  schema: {
    type: 'object' as const,             // ← 'as const' is REQUIRED
    properties: {
      reason: { type: 'string', example: 'Policy violation' },
    },
    required: ['reason'],
  },
})
@ApiOkResponse({ description: '{Entity} suspended', schema: {entity}ResponseSchema })
@ApiBadRequestResponse({ description: 'Validation error' })
@ApiNotFoundResponse({ description: '{Entity} not found' })
@ApiConflictResponse({ description: '{Entity} is already suspended or cannot transition from current status' })
@ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
suspend{Entity}(
  @Param('{entity}Id') {entity}Id: string,
  @Body(new ZodValidationPipe(suspend{Entity}Schema)) body: Suspend{Entity}Input,
) {
  return this.{entity}ApplicationService.suspend{Entity}({ {entity}Id, ...body });
}
```

**Route ordering reminder:** add state-changing action routes **after** the entity's non-parameterized routes but **before** any catch-all dynamic routes if ordering matters.

---

### Step 8 — Module Registration

File: `apps/{domain}/{service}/src/modules/{domain}.module.ts`

If a new use case was added, register it as a provider:

```typescript
{
  provide: Suspend{Entity}UseCase,
  useFactory: (repo: I{Entity}Repository) => new Suspend{Entity}UseCase(repo),
  inject: [{ENTITY}_REPOSITORY],
},
```

If the use case depends on an ACL validator (from Step 3a), inject both the repository and the validator:

```typescript
{
  provide: Create{Entity}UseCase,
  useFactory: (repo: I{Entity}Repository, validator: I{UpstreamEntity}Validator) =>
    new Create{Entity}UseCase(repo, validator),
  inject: [{ENTITY}_REPOSITORY, I{UpstreamEntity}Validator],
},
```

Also add `HttpModule` to the module `imports` and provide the ACL client — see `sync-cross-service-call` skill Step 5.

Inject it into `{Entity}ApplicationService` constructor as well (NestJS will resolve it by class token).

---

### Step 9 — Exception Filter

File: `apps/{domain}/{service}/src/presentation/filters/domain-exception.filter.ts`

If a new domain exception was created in Step 2c, add it to `DOMAIN_ERROR_MAP`:

```typescript
import { {Entity}AlreadySuspendedError } from '@mma/{domain}-domain';

const DOMAIN_ERROR_MAP: ... = [
  // ... existing
  [{Entity}AlreadySuspendedError, HttpStatus.CONFLICT],
];
```

See the `domain-exception-filter` skill for the full filter pattern.

---

### Step 10 — Tests

Write unit tests for any new code:

- **Entity method:** test happy path + each guard condition (see `write-domain-tests` skill)
- **Use case:** test not-found path + success path with mocked repository
- **Application service:** only if orchestration logic was added; skip for pass-through methods

---

## Quick Reference: Which Layers Are Affected

| Change type | Affected layers |
|---|---|
| New state transition | Domain constants, entity method, domain exception, use case, app service, controller, filter |
| New query/list endpoint | Repository interface, repository impl (+ GSI in schema), **LocalStack script**, use case, app service, controller |
| New field on entity | Domain entity, DynamoDB schema, contracts schema, app service `toDto()` |
| New GSI on schema | DynamoDB schema file, **`scripts/setup-localstack.ts`** — run `--force` to apply |
| New input validation | Contracts schema, controller pipe, (optionally) application exception |
| Rename/delete a field | Domain entity, contracts schema, DynamoDB schema (migration may be needed), app service |
| Cross-service validation | ACL interface + exceptions (domain pkg), ACL adapter (infra/clients), HttpModule + provider (module), exception filter, `.env.local` |
| Publish events to another domain | Event constants + payload interfaces (domain pkg), event schemas (contracts), publisher wiring (module), `.env.local`, LocalStack queue |
| React to events from another domain | Event handler service + per-event handlers (consuming service), SqsLocalService, module wiring, `.env.local`, LocalStack queue |
| New feature visible in webapp | API client method, React Query hook, domain component(s), page orchestrator, status-variant mapping (if new status) |
| New feature visible in mobile | (shared) API client method + React Query hook from `client-common`, mobile domain component, mobile screen, status-variant mapping (if new status) |

---

## Step 11 — Webapp Touchpoints (if the feature is user-facing)

Skip this step if the feature is backend-only (e.g. internal event handler, background job).

When the new capability must be visible in the Next.js webapp, work through these sub-steps **after** the backend is complete.

**11a. API Client Method**
File: `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`

Add a method matching the new backend endpoint. Every method must pass a Zod `schema` option for response validation. Follow the `webapp-api-client-hooks` skill.

**11b. React Query Hook**
File: `packages/client-common/src/hooks/use-{domain}s.ts`

Add a query hook (for reads) or mutation hook (for writes). Mutations must invalidate the domain query key on success. Export from `packages/client-common/src/hooks/index.ts`. Follow the `webapp-api-client-hooks` skill.

**11c. Domain Components**
Files: `apps/webapp/src/components/{domain}/`

Update or create the component that surfaces the new feature:
- **New column in a table** — update `{domain}-table.tsx`
- **New action button** — update `{domain}-actions.tsx` (add mutation hook + conditional render based on entity status)
- **New create/edit form** — create `{verb}-{entity}-form.tsx` or update existing form
- **New detail view** — create `{entity}-detail.tsx`

Follow the `webapp-new-page` skill for component patterns.

**11d. Page Orchestrator**
File: `apps/webapp/src/app/{domain}/page.tsx`

If the feature adds new UI state (filters, modals, pagination), update the page to wire the new hooks and components. Pages stay thin — logic lives in hooks and components.

**11e. Status-Variant Mapping (only if new status was added)**
File: `apps/webapp/src/lib/status-variants.ts`

Add the new status to the variant mapper using the enum constant from `@mma/contracts/{domain}`. Follow the `webapp-new-page` skill.

**11f. UI Primitive (only if no existing component fits)**
If the feature needs a component that doesn't exist in `@mma/ui`, create it following the `webapp-ui-primitive` skill. This is rare — check the existing primitives first.

---

## Step 12 — Mobile Touchpoints (if the feature is user-facing on mobile)

Skip this step if the feature is backend-only or webapp-only.

When the new capability must also be visible in the Expo (React Native) mobile app, work through these sub-steps **after** the backend (and ideally the shared data-access layer from Step 11a/11b) is complete.

**Important:** Steps 11a and 11b (API client method + React Query hook) are shared between webapp and mobile via `@mma/client-common`. You do NOT need to create separate mobile hooks — complete Step 11a/11b once and both platforms can consume them.

**12a. Domain List Component (if new domain or new list field)**
File: `apps/mobile/src/components/{domain}/{domain}-list.tsx`

Update the list item to show new fields, or create a new list component for a new domain. Follow the `mobile-new-screen` skill (Step 3) for the FlatList + Card pattern.

**12b. Tab Screen (if new domain)**
File: `apps/mobile/src/app/(tabs)/{domain}.tsx`

Create a new tab screen with filter state + list component. Register it in `apps/mobile/src/app/(tabs)/_layout.tsx`. Follow the `mobile-new-screen` skill (Steps 4 + 6).

**12c. Detail Screen (if new action or new field)**
File: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`

Update the detail screen to show new fields or add new action buttons. For a new domain, create the full detail screen. Follow the `mobile-new-screen` skill (Step 5).

**12d. Status-Variant Mapping (only if new status was added)**
File: `apps/mobile/src/lib/status-variants.ts`

Add the new status to the variant mapper using the enum constant from `@mma/contracts/{domain}`. Return type is `BadgeVariant` from `@mma/mobile-ui`.

**12e. Mobile UI Primitive (only if no existing component fits)**
If the feature needs a component that doesn't exist in `@mma/mobile-ui`, create it following the `mobile-ui-primitive` skill. Check existing primitives first (Badge, Button, Card, Input, Text, Separator).

**12f. Environment Setup (only if new domain)**
File: `apps/mobile/src/app/_layout.tsx`

Add the new domain's API URL to `configureApi()` and add `EXPO_PUBLIC_API_{DOMAIN}_URL` to environment config.

---

## Common Mistakes to Avoid

- **Skipping the contracts update** — the application service will fail at Zod parse time.
- **Adding the use case to the module but not injecting it into the application service constructor.**
- **Adding the domain exception but not registering it in `DOMAIN_ERROR_MAP`** — it will silently become a 500.
- **Calling `reconstitute()` in a use case when you mean `create()`** — `reconstitute()` skips invariant validation.
- **Hardcoding status/role strings** — always use `{Entity}StatusEnum.SUSPENDED`, never `'SUSPENDED'`.
