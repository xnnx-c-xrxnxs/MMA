---
name: sync-cross-service-call
description: Add a synchronous HTTP call from one API service to another, using an Anti-Corruption Layer (ACL) to keep the consuming domain decoupled. Use this when a use case requires real-time validation against another bounded context — for example, Order service validating a customer exists via the User API.
---

# Synchronous Cross-Service Call (ACL Pattern)

> **Use this when a use case needs a real-time answer from another bounded context before proceeding.** For loosely-coupled, eventually-consistent communication use the `sqs-event-publisher` and `cross-domain-event-handler` skills instead.

Canonical reference: Order API → User API customer validation (to be implemented).

---

## When to Use Synchronous vs. Asynchronous

| Criterion | Synchronous (this skill) | Asynchronous (event-driven) |
|---|---|---|
| The operation **cannot proceed** without the answer | ✓ | |
| There is **no recovery path** if the data is wrong (e.g. order for non-existent customer) | ✓ | |
| The upstream data changes **slowly** (identity, status) | ✓ | |
| The consuming service can **tolerate stale data** (seconds/minutes) | | ✓ |
| You want the consuming service to **keep working** when the upstream is down | | ✓ |
| The data is a **point-in-time snapshot** that is frozen at creation (e.g. product price) | | ✓ |

**Rule of thumb:** If the answer is a **gate** (proceed / reject), use sync. If the answer is **informational** and can be slightly outdated, use async.

---

## Required Information — Ask Before Starting

1. **Consuming service** (e.g. `order-api-service`) — the service that needs to call out.
2. **Upstream service** (e.g. `user-api-service`) — the service being called.
3. **What data does the consuming service need?** — list the exact fields (e.g. `userId`, `userStatus`). Keep this minimal — only what's needed for the gate check.
4. **What endpoint on the upstream service?** — the route and HTTP method (e.g. `GET /users/:userId`).
5. **What should happen when the upstream service is unreachable?** — fail the request (default) or degrade gracefully.
6. **Which use case(s) call the ACL?** — determines where the interface is injected.

---

## Architecture Overview

```
packages/{consuming-domain}-domain/
  src/application/
    interfaces/
      {upstream-entity}-validator.interface.ts     ← ACL PORT (abstract class)

apps/{consuming-domain}/{service}/
  src/infrastructure/
    clients/
      {upstream-domain}-api.client.ts              ← ACL ADAPTER (HTTP implementation)
  src/modules/
    {domain}.module.ts                             ← wires HttpModule + client provider
```

The consuming domain defines an **abstract interface** (port) that describes what it needs — not how to get it. The infrastructure layer provides a **concrete HTTP client** (adapter) that implements the interface.

**Key isolation guarantee:** The domain package (`packages/{consuming-domain}-domain`) **never imports from** `@old-st/{upstream-domain}` or from the upstream service. It defines its own interface with its own types.

---

## Step 1 — Define the ACL Interface (Port)

File: `packages/{consuming-domain}-domain/src/application/interfaces/{upstream-entity}-validator.interface.ts`

```typescript
/**
 * I{UpstreamEntity}Validator
 *
 * Anti-Corruption Layer (ACL) port — defines what the {consuming} domain needs
 * from the {upstream} bounded context WITHOUT coupling to its internal types.
 *
 * Implemented by an HTTP adapter in the service's infrastructure/clients/ layer.
 * Injected into use cases that need to validate {upstream} entities.
 */
export interface Validated{UpstreamEntity} {
  /** The upstream entity's unique identifier. */
  {upstreamEntity}Id: string;
  /** The upstream entity's current status — only the values relevant to this domain. */
  status: string;
}

export abstract class I{UpstreamEntity}Validator {
  /**
   * Validate that the {upstream entity} exists and is in a valid state.
   *
   * @returns The validated entity summary if valid.
   * @throws {UpstreamEntity}NotFoundError if the entity does not exist.
   * @throws {UpstreamEntity}InvalidStatusError if the entity exists but is not in a valid state.
   * @throws {UpstreamEntity}ServiceUnavailableError if the upstream service is unreachable.
   */
  abstract validate(id: string): Promise<Validated{UpstreamEntity}>;
}
```

**Why an abstract class instead of an interface:**
- NestJS dependency injection requires a **class token** for constructor injection (no string token needed).
- Abstract classes serve as both the TypeScript type and the DI token.
- This is the same pattern used by `I{Entity}Repository` in the existing codebase.

**Rules:**
- `Validated{UpstreamEntity}` contains **only the fields the consuming domain needs** — never the full upstream entity shape.
- The validator interface lives in the **consuming** domain's `application/interfaces/`, not the upstream's.
- Never import types from `@old-st/{upstream-domain}` — define local types for the response.
- Status strings are intentionally `string` (not the upstream's enum) — the consuming domain may map them to its own concept.

---

## Step 2 — Define ACL Exceptions

File: `packages/{consuming-domain}-domain/src/application/exceptions/{upstream-entity}-validation.error.ts`

```typescript
/**
 * Thrown when the upstream {entity} does not exist.
 */
export class {UpstreamEntity}NotFoundError extends Error {
  constructor(id: string) {
    super(`{UpstreamEntity} ${id} not found in upstream service`);
    this.name = '{UpstreamEntity}NotFoundError';
  }
}

/**
 * Thrown when the upstream {entity} exists but is in an invalid state
 * for the current operation (e.g. DELETED, INACTIVE).
 */
export class {UpstreamEntity}InvalidStatusError extends Error {
  constructor(id: string, status: string) {
    super(`{UpstreamEntity} ${id} has invalid status: ${status}`);
    this.name = '{UpstreamEntity}InvalidStatusError';
  }
}

/**
 * Thrown when the upstream service is unreachable or returns an unexpected error.
 */
export class {UpstreamEntity}ServiceUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? '{UpstreamEntity} validation service is unavailable');
    this.name = '{UpstreamEntity}ServiceUnavailableError';
  }
}
```

Update barrel exports:
- `packages/{consuming-domain}-domain/src/application/exceptions/index.ts`
- `packages/{consuming-domain}-domain/src/application/interfaces/index.ts`
- `packages/{consuming-domain}-domain/src/application/index.ts`
- `packages/{consuming-domain}-domain/src/index.ts`

---

## Step 3 — Inject ACL into Use Case

The use case receives the ACL validator alongside its repository — both are constructor dependencies.

File: `packages/{consuming-domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.ts`

```typescript
import { I{UpstreamEntity}Validator } from '../../interfaces/{upstream-entity}-validator.interface';
import { I{Entity}Repository } from '../../interfaces/{entity}-repository.interface';

export class {Verb}{Entity}UseCase implements IUseCase<{Verb}{Entity}Input, {Entity}> {
  constructor(
    private readonly {entity}Repository: I{Entity}Repository,
    private readonly {upstreamEntity}Validator: I{UpstreamEntity}Validator,
  ) {}

  async execute(input: {Verb}{Entity}Input): Promise<{Entity}> {
    // 1. Validate the upstream entity (throws if invalid)
    await this.{upstreamEntity}Validator.validate(input.{upstreamEntity}Id);

    // 2. Proceed with domain logic
    const entity = {Entity}.create({ ...input });
    return this.{entity}Repository.save(entity);
  }
}
```

**Rules:**
- The ACL call happens **before** any domain state mutation.
- The use case does NOT catch ACL exceptions — they propagate to the exception filter.
- The use case does NOT use the `Validated{UpstreamEntity}` return value unless it needs specific fields (e.g. to store a snapshot). For a pure gate check, the return value can be ignored — the method throws on failure.

---

## Step 4 — Implement the HTTP Client (Adapter)

File: `apps/{consuming-domain}/{service}/src/infrastructure/clients/{upstream-domain}-api.client.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createLogger, getOutboundHeaders } from '@old-st/telemetry';
import {
  I{UpstreamEntity}Validator,
  Validated{UpstreamEntity},
  {UpstreamEntity}NotFoundError,
  {UpstreamEntity}InvalidStatusError,
  {UpstreamEntity}ServiceUnavailableError,
} from '@old-st/{consuming-domain}-domain';

const logger = createLogger('{consuming-domain}-api-service');

@Injectable()
export class {UpstreamDomain}ApiClient extends I{UpstreamEntity}Validator {

  /**
   * The base URL of the upstream API service.
   * Sourced from environment: API_{UPSTREAM_DOMAIN}_URL
   * Example: http://localhost:3000/api
   */
  private readonly baseUrl = process.env.API_{UPSTREAM_DOMAIN}_URL ?? '';

  constructor(private readonly httpService: HttpService) {
    super();
  }

  async validate(id: string): Promise<Validated{UpstreamEntity}> {
    const url = `${this.baseUrl}/{upstream-entities}/${encodeURIComponent(id)}`;

    logger.info('Validating {upstream-entity} via {UpstreamDomain} API', { {upstreamEntity}Id: id });

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 5000,
          // getOutboundHeaders() forwards BOTH the originating Authorization
          // header AND the correlationId (captured by correlationMiddleware()).
          // This preserves the actor identity end-to-end (downstream
          // @CurrentUser() resolves to the same user) AND keeps the trace chain.
          headers: { ...getOutboundHeaders() },
        }),
      );

      const data = response.data;

      // Map upstream response to local ACL type — never expose full upstream shape
      const validated: Validated{UpstreamEntity} = {
        {upstreamEntity}Id: data.{upstreamEntity}Id,
        status: data.{upstreamEntity}Status,
      };

      // Gate check: reject invalid statuses
      const validStatuses = ['ACTIVE'];
      if (!validStatuses.includes(validated.status)) {
        throw new {UpstreamEntity}InvalidStatusError(id, validated.status);
      }

      logger.info('{UpstreamEntity} validated successfully', { {upstreamEntity}Id: id, status: validated.status });

      return validated;
    } catch (error) {
      // Re-throw our own exceptions as-is
      if (
        error instanceof {UpstreamEntity}NotFoundError ||
        error instanceof {UpstreamEntity}InvalidStatusError ||
        error instanceof {UpstreamEntity}ServiceUnavailableError
      ) {
        throw error;
      }

      // Map HTTP errors to domain exceptions
      if (this.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          throw new {UpstreamEntity}NotFoundError(id);
        }
        if (status === 409) {
          const msg = error.response?.data?.message ?? 'invalid status';
          throw new {UpstreamEntity}InvalidStatusError(id, msg);
        }
        // Any other HTTP error (5xx, timeout, connection refused)
        logger.error(
          `Upstream {upstream-domain} API error: ${status ?? 'no response'}`,
          { status: status ?? 'no response' },
          error,
        );
        throw new {UpstreamEntity}ServiceUnavailableError(
          `Upstream {upstream-domain} API returned ${status ?? 'no response'}`,
        );
      }

      // Non-Axios error (e.g. JSON parse failure)
      logger.error('Unexpected error calling {upstream-domain} API', {}, error);
      throw new {UpstreamEntity}ServiceUnavailableError();
    }
  }

  private isAxiosError(error: unknown): error is { response?: { status: number; data?: { message?: string } }; message: string } {
    return typeof error === 'object' && error !== null && 'isAxiosError' in error;
  }
}
```

**Rules:**
- Imports domain types from `@old-st/{consuming-domain}-domain` — never from the upstream domain.
- Uses `API_{UPSTREAM_DOMAIN}_URL` env var (already in `.env.local` convention from engineering-handbook §7.1).
- `timeout: 5000` — always set a timeout on cross-service calls. Adjust based on SLA.
- **Must propagate `x-correlation-id` AND `Authorization`** via `getOutboundHeaders()` from `@old-st/telemetry`. Without this, the receiving service generates a new correlationId (breaking the event chain) AND its `JwtAuthGuard` rejects the request with 401 (no auth header). The `correlationMiddleware()` on the receiving side reuses the incoming header automatically. **Golden Rule #46.**
- Maps HTTP status codes to typed domain exceptions — the application layer never sees Axios errors.
- Uses `encodeURIComponent(id)` for the path parameter to prevent injection.
- `firstValueFrom` converts the Axios Observable to a Promise.
- Uses `createLogger()` from `@old-st/telemetry` — never `new Logger()` from `@nestjs/common` (Golden Rule #35).
- **Must log before and after the outbound call** so the ACL validation appears in the monitoring event chain. Without logs on both the calling adapter AND the receiving service's application method, the cross-service call is invisible in the event chain dashboard.

### Logging on the Receiving Side

The upstream service's application method that handles the ACL request (e.g. `getUserById`) **must also have before/after logs** — even though it is nominally a read-only method. Without these logs, the upstream service won't appear in the monitoring event chain for the calling service's correlationId.

```typescript
// In the UPSTREAM service's application service:
async get{Entity}ById(id: string): Promise<{Entity}Response> {
  logger.info('Retrieving {entity} by ID', { {entity}Id: id });
  const entity = await this.get{Entity}ByIdUseCase.execute(id);
  logger.info('{Entity} retrieved', { {entity}Id: id, status: entity.getStatus() });
  return this.toDto(entity);
}
```

This ensures the full cross-service call chain appears in the monitoring dashboard: calling service adapter logs → upstream service application logs → all linked by the same correlationId.

---

## Step 5 — Wire in NestJS Module

File: `apps/{consuming-domain}/{service}/src/modules/{domain}.module.ts`

```typescript
import { HttpModule } from '@nestjs/axios';
import { I{UpstreamEntity}Validator } from '@old-st/{consuming-domain}-domain';
import { {UpstreamDomain}ApiClient } from '../infrastructure/clients/{upstream-domain}-api.client';

const {UPSTREAM_ENTITY}_VALIDATOR = '{UPSTREAM_ENTITY}_VALIDATOR';

@Module({
  imports: [HttpModule],   // ← required for HttpService injection
  providers: [
    // ... existing providers (table, repository, use cases) ...

    // ACL client — implements I{UpstreamEntity}Validator
    {
      provide: I{UpstreamEntity}Validator,
      useClass: {UpstreamDomain}ApiClient,
    },

    // Use case that depends on the ACL — inject both repository and validator
    {
      provide: {Verb}{Entity}UseCase,
      useFactory: (
        repo: I{Entity}Repository,
        validator: I{UpstreamEntity}Validator,
      ) => new {Verb}{Entity}UseCase(repo, validator),
      inject: [{ENTITY}_REPOSITORY, I{UpstreamEntity}Validator],
    },

    // ... remaining providers ...
  ],
})
export class {Domain}Module {}
```

**Rules:**
- `HttpModule` from `@nestjs/axios` must be imported in the module's `imports` array.
- The ACL client is provided using `useClass` with the abstract class as token — same pattern as repositories.
- Use cases that depend on the ACL get the validator injected via `useFactory` alongside the repository.
- Install `@nestjs/axios` and `axios` if not already in the service's dependencies:
  ```bash
  pnpm add @nestjs/axios axios
  ```

---

## Step 6 — Register ACL Exceptions in Domain Exception Filter

File: `apps/{consuming-domain}/{service}/src/presentation/filters/domain-exception.filter.ts`

```typescript
import {
  {UpstreamEntity}NotFoundError,
  {UpstreamEntity}InvalidStatusError,
  {UpstreamEntity}ServiceUnavailableError,
} from '@old-st/{consuming-domain}-domain';

// Add to DOMAIN_ERROR_MAP:
[{UpstreamEntity}NotFoundError, HttpStatus.NOT_FOUND],             // upstream entity not found
[{UpstreamEntity}InvalidStatusError, HttpStatus.CONFLICT],         // upstream entity in invalid state
[{UpstreamEntity}ServiceUnavailableError, HttpStatus.BAD_GATEWAY], // upstream service unreachable (502)
```

**HTTP status code rationale:**
- `404` — the resource the client referenced does not exist (even though it's in another service).
- `409` — the business rule was violated (entity in wrong state) — consistent with how domain exceptions map.
- `502 Bad Gateway` — the server (acting as a gateway) received an invalid response from the upstream service. This is the standard HTTP status for proxy/gateway failures.

---

## Step 7 — Update `.env.local`

The `API_{UPSTREAM_DOMAIN}_URL` env var should already exist (it's part of the standard port registry in engineering-handbook §7.1). Verify it's present:

```env
API_USER_URL=http://localhost:3000/api
API_PRODUCT_URL=http://localhost:3001/api
```

If the upstream service doesn't yet have an entry, add one following the port registry convention.

---

## Step 8 — Install Dependencies

```bash
# In the consuming service (or workspace root)
pnpm add @nestjs/axios axios
```

Verify `@nestjs/axios` is available. It provides `HttpModule` and `HttpService`.

---

## Testing: Mocking the ACL

In use case unit tests, mock the validator:

```typescript
const mockValidator: I{UpstreamEntity}Validator = {
  validate: jest.fn(),
};

// Happy path — validator resolves
(mockValidator.validate as jest.Mock).mockResolvedValue({
  {upstreamEntity}Id: 'usr_123',
  status: 'ACTIVE',
});

// Not found path — validator throws
(mockValidator.validate as jest.Mock).mockRejectedValue(
  new {UpstreamEntity}NotFoundError('usr_999'),
);

// Invalid status path
(mockValidator.validate as jest.Mock).mockRejectedValue(
  new {UpstreamEntity}InvalidStatusError('usr_456', 'DELETED'),
);

// Service unavailable path
(mockValidator.validate as jest.Mock).mockRejectedValue(
  new {UpstreamEntity}ServiceUnavailableError(),
);
```

In the test constructor:
```typescript
const useCase = new {Verb}{Entity}UseCase(mockRepo, mockValidator);
```

---

## Common Mistakes to Avoid

- **Importing upstream domain types in the consuming domain package.** The ACL interface must define its own `Validated{UpstreamEntity}` type — never import upstream entity types from `@old-st/{upstream-domain}-domain`.
- **Catching ACL exceptions in the use case.** Let them propagate — the exception filter handles HTTP mapping.
- **Forgetting to import `HttpModule` in the NestJS module.** `HttpService` won't be injectable without it.
- **Using `fetch()` or raw `http` instead of `@nestjs/axios`.** The `HttpService` from `@nestjs/axios` is the standard HTTP client in NestJS — it integrates with NestJS DI and testing.
- **Hardcoding the upstream URL.** Always use `API_{DOMAIN}_URL` from environment.
- **Not setting a timeout.** Cross-service calls must always have a timeout to prevent cascade failures.
- **Not propagating correlationId AND Authorization.** Always spread `...getOutboundHeaders()` into outbound HTTP headers. Without this, the upstream service generates a new correlationId (breaking the end-to-end event chain) AND rejects the call with 401 once API Gateway JWT auth is enabled. The legacy `getCorrelationHeaders()` only sends `x-correlation-id` and is kept for backward compat — prefer `getOutboundHeaders()` for any cross-service call to an authenticated endpoint.
- **Returning the full upstream response to the use case.** The adapter maps to `Validated{UpstreamEntity}` with only the fields the consuming domain needs.

---

## Architecture Decision: Why Abstract Class, Not Interface + String Token

| Approach | Pros | Cons |
|---|---|---|
| Abstract class (used here) | Class token for DI — no `@Inject('TOKEN')` strings; same pattern as `I{Entity}Repository` | Slight overhead of `extends` in adapter |
| Interface + `@Inject('TOKEN')` | Lighter TypeScript type | Inconsistent with repository pattern; string tokens are error-prone |

The abstract class approach maintains consistency with how repositories are injected everywhere in this codebase.
