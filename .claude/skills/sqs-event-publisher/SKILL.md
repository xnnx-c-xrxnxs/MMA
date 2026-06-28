---
name: sqs-event-publisher
description: Add an SQS event publisher to an existing HTTP API service or domain package. Use this when a service must publish domain events to an SQS queue (FIFO by default, Standard as opt-out). Covers IEventPublisher<T> injection, SqsFifoEventPublisher wiring (default), module provider token, .env.local entries, and LocalStack queue creation.
---

# Adding an SQS Event Publisher to an Existing Service

> **This skill is for outbound publishing only.** For consuming SQS messages use the `sqs-event-driven-service` skill instead.

> **Cross-domain publishing:** When the events you publish will be consumed by a **different bounded context** (e.g. Product API publishing events consumed by Order Event Handler), ensure the event schemas and type constants are defined in the **publishing domain's contracts** (`@mma/contracts/{publishing-domain}`). The consumer will import from that subpath — see the `cross-domain-event-handler` skill. Queue naming convention for cross-domain: `{publishing-domain}-events-for-{consuming-domain}` (e.g. `product-events-for-orders`).

---

## Required Information — Ask Before Starting

1. **Domain name** (e.g. `users`, `products`) — determines which service module to update.
2. **Service folder** (e.g. `apps/{domain}/{domain}-api-service`) — the service that needs to publish events.
3. **Queue type** — FIFO (default) or Standard (opt-out for high-throughput fan-out)?
4. **Queue name / env var** — the physical queue name and the env var that holds it (e.g. `USERS_SQS_QUEUE_NAME`).
5. **Event payload type** — the TypeScript type / Zod schema that represents the event body.
6. **Which use cases or application service methods trigger publishing?** — the exact call sites.

---

## Decision Guide: FIFO (default) vs Standard (explicit opt-out)

| Requirement | Choose |
|---|---|
| Events must be processed in strict order per entity (e.g. all events for user `123` in order) | **FIFO** (default) |
| Exactly-once delivery guarantee (no duplicates processed) | **FIFO** (default) |
| High throughput, no ordering requirement | **Standard** (explicit opt-out) |
| Inter-service fan-out / notification pattern | **Standard** (explicit opt-out) |

> **FIFO is the default queue type.** Use `SqsFifoEventPublisher` unless you have a specific reason to opt out to Standard.
> FIFO queue names **must** end in `.fifo`. The `setup-localstack.ts` script auto-appends this suffix when `fifo: true` is set in `QUEUE_CONFIGS` (which is now the default — set `fifo: false` to opt out to Standard).
> `delaySeconds` is **not supported** per-message on FIFO queues. Remove it from `EventPublishOptions` if you are publishing to FIFO.

---

## Package

The concrete publishers live in `@mma/aws-sqs` (`packages/aws/aws-sqs`).  
The interface lives in `@mma/common`.

```
@mma/common    → IEventPublisher<T>, EventPublishOptions
@mma/aws-sqs   → SqsStandardEventPublisher<T>, SqsFifoEventPublisher<T>
                    createLocalSqsClient(), createAwsSqsClient()
```

**Never import the concrete publisher class into application logic.**  
Always inject `IEventPublisher<T>` — the concrete class is wired only in the NestJS module.

---

## Step 1 — Define the Event Payload Type

If the event type already exists in `packages/contracts/{domain}/src/schemas.ts`, skip this step.

Add a Zod schema for the event payload following the `add-contracts` skill. Convention:

```typescript
// packages/contracts/{domain}/src/schemas.ts
export const userEventPayloadSchema = z.object({
  eventType: z.string(),
  userId: z.string(),
  occurredAt: z.string(),
  // ... domain-specific fields
});

export type UserEventPayload = z.infer<typeof userEventPayloadSchema>;
```

---

## Step 2 — Add the Publisher Token

In `apps/{domain}/{service}/src/modules/{domain}.module.ts`, add a local string constant for the publisher token:

```typescript
const USER_EVENT_PUBLISHER = 'USER_EVENT_PUBLISHER';
```

Convention: `{ENTITY}_EVENT_PUBLISHER` (uppercase, same pattern as `{ENTITY}_REPOSITORY`).

---

## Step 3 — Wire the Publisher in the Module

```typescript
import { SqsFifoEventPublisher, SqsStandardEventPublisher, createLocalSqsClient, createAwsSqsClient } from '@mma/aws-sqs';

// inside @Module({ providers: [...] })
{
  provide: USER_EVENT_PUBLISHER,
  useFactory: () => {
    const client =
      process.env.STAGE === 'local'
        ? createLocalSqsClient()
        : createAwsSqsClient();
    const queueUrl = process.env.USERS_SQS_QUEUE_URL ?? '';
    if (!queueUrl && process.env.STAGE !== 'local') {
      throw new Error('Missing required env var: USERS_SQS_QUEUE_URL');
    }
    // FIFO is the default — use SqsStandardEventPublisher only for explicit Standard opt-out:
    return new SqsFifoEventPublisher(client, queueUrl);
    // Explicit Standard opt-out (high-throughput fan-out, no ordering requirement):
    // return new SqsStandardEventPublisher(client, queueUrl);
  },
},
```

**Rules:**
- `STAGE === 'local'` is the **only** guard — never `NODE_ENV === 'development'`.
- `createAwsSqsClient()` reads `process.env.AWS_REGION` (auto-injected by Lambda runtime) to create the SQS client in the correct region. It falls back to `'us-east-1'` if the env var is not set. You do **not** need to pass the region explicitly.
- `queueUrl` defaults to `''` with `?? ''` so the service boots without crashing
  locally when `.env.local` is incomplete. In deployed environments (`STAGE !== 'local'`),
  a missing queue URL throws immediately at module initialization — failing fast at
  cold-start rather than silently producing `QueueDoesNotExist` errors on the first
  publish attempt.
- The factory has no `inject:` dependencies — it reads env vars directly (same as
  DynamoDBConfig does).

### CorrelationId Auto-Injection

Both `SqsStandardEventPublisher` and `SqsFifoEventPublisher` **automatically inject `correlationId`** into every published event body. The publisher calls `getCorrelationId()` from `@mma/telemetry` (which reads from the `AsyncLocalStorage` context set by `correlationMiddleware()`) and merges it into the event payload before `JSON.stringify`. No manual work is needed — if a `correlationId` exists in the current request context, it will be propagated to the SQS message body automatically.

This means the consumer (event handler) can extract the `correlationId` from the raw message body and wrap its processing in `runWithCorrelationId()`, creating end-to-end request tracing across HTTP → SQS → event handler chains.

**Event schema requirement:** All event schemas in `@mma/contracts/{domain}/event-schemas.ts` must include `correlationId: z.string().optional()` so the auto-injected field passes Zod validation on the consumer side.

---

## Step 4 — Inject into the Application Service

```typescript
// apps/{domain}/{domain}-api-service/src/application/services/{entity}-application.service.ts
import type { IEventPublisher, EventPublishOptions } from '@mma/common';
import type { {Entity}EventPayload } from '@mma/contracts/{domain}';

@Injectable()
export class UserApplicationService {
  constructor(
    // ... use case injections
    @Inject('USER_EVENT_PUBLISHER')
    private readonly eventPublisher: IEventPublisher<UserEventPayload>,
  ) {}

  async activateUser(userId: string): Promise<UserDto> {
    const entity = await this.activateUserUseCase.execute(userId);
    // Publish event after successful use-case execution:
    await this.eventPublisher.publish({
      eventType: 'USER_ACTIVATED',
      userId: entity.id,
      occurredAt: new Date().toISOString(),
    });
    return userResponseSchema.parse(entity.toPlainObject());
  }
}
```

**Rules:**
- Inject `IEventPublisher<T>` (interface), never the concrete class.
- Use `@Inject('USER_EVENT_PUBLISHER')` with the string token (no class token available).
- Publish **after** the use case succeeds — never before.
- Do **not** catch publisher errors in the application service unless you want to swallow them. Let them propagate to the controller filter.
- For FIFO queues (the default), always pass `options.groupId` (e.g. the entity ID) to maintain per-entity ordering:
  ```typescript
  await this.eventPublisher.publish(payload, { groupId: entity.id });
  ```

### Delta Event Payload Pattern (Old + New Values)

When an event must carry **both the old and new values** of a changed field (e.g. price change events for downstream consumers to detect drift), the application service reads the current state **before** executing the use case.

```typescript
async updatePrice(entityId: string, input: UpdatePriceInput): Promise<EntityResponse> {
  // 1. Capture old value BEFORE the mutation
  const existing = await this.getByIdUseCase.execute(entityId);
  const oldPrice = existing.getPrice();

  // 2. Execute the mutation
  const entity = await this.updatePriceUseCase.execute({
    entityId,
    price: input.price,
  });

  // 3. Publish delta event with old + new values
  await this.eventPublisher.publish({
    eventType: EventTypeEnum.PRICE_CHANGED,
    entityId: entity.getId() as string,
    oldPrice,
    newPrice: input.price,
    occurredAt: new Date().toISOString(),
  });

  return this.toDto(entity);
}
```

**Rules:**
- The pre-read is the application service's responsibility — not the use case's.
- Only read the specific field(s) needed for the event payload. The use case handles the full mutation and guards.
- If the pre-read throws (entity not found), let it propagate — the point is that the entity must exist before updating.
- This pattern is typical for `PRICE_CHANGED`, `STATUS_CHANGED`, and similar events where consumers need the before/after delta.

---

## Step 5 — Register the Provider Export (if needed)

If another module within the same service needs to inject the publisher, add `USER_EVENT_PUBLISHER` to the `exports` array of the module. Otherwise, do **not** export it.

---

## Step 6 — Update `.env.local`

Add the following to `.env.local` at the workspace root (see §7.1 of docs/engineering-handbook.md).
**FIFO is the default** — queue names and URLs end in `.fifo`:

```env
# SQS — Users domain (FIFO by default)
USERS_SQS_QUEUE_NAME=users-events
USERS_SQS_QUEUE_URL=http://sqs.{DEFAULT_REGION_VALUE}.localhost.localstack.cloud:4566/000000000000/users-events.fifo
```

> The `.fifo` suffix on the URL is applied by the setup script automatically when `fifo: true` (the default).
> The `USERS_SQS_QUEUE_NAME` env var holds the **base name** (without `.fifo`). The script appends the suffix.
>
> For explicit Standard queues (opt-out), omit the `.fifo` suffix from the URL and set `fifo: false` in `QUEUE_CONFIGS`.

> The URL format is always:
> `http://sqs.{DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/{queue-name}`
>
> The region segment must match `DEFAULT_REGION` in `.env.local`. Do **not** add a separate `AWS_DEFAULT_REGION` var.

---

## Step 7 — Add the Queue to `scripts/setup-localstack.ts`

In the `QUEUE_CONFIGS` array:

```typescript
// FIFO queue (default):
{
  queueNameEnvVar: 'USERS_SQS_QUEUE_NAME',
  queueNameDefault: 'users-events',
  description: 'user-api-service — publishes ordered user domain events',
  fifo: true,
},

// Standard queue (explicit opt-out for high-throughput fan-out):
{
  queueNameEnvVar: 'USERS_SQS_QUEUE_NAME',
  queueNameDefault: 'users-events',
  description: 'user-api-service — publishes user domain events (standard/high-throughput)',
  // fifo: false — explicit Standard opt-out
},
```

> When `fifo: true`, the script automatically appends `.fifo` to the queue name if not already present, and sets `ContentBasedDeduplication: 'true'` on the created queue.

Then recreate queues:
```bash
pnpm run localstack:setup:force
```

Copy the printed `USERS_SQS_QUEUE_URL` into `.env.local`.

---

## Step 8 — Install the Package Dependency

In `apps/{domain}/{service}/package.json` (or the root if there is no per-service package.json), add:

```json
"@mma/aws-sqs": "workspace:*"
```

Then run:
```bash
pnpm install
```

---

## EventPublishOptions Reference

| Option | Type | FIFO queue (default) | Standard queue (opt-out) |
|---|---|---|---|
| `groupId` | `string` | **Required** — mapped to `MessageGroupId`; use root entity ID (e.g. `userId`) | Optional (enables fair-queue routing) |
| `deduplicationId` | `string` | Optional — defaults to SHA-256 hash of body | Ignored |
| `delaySeconds` | `number` | **Not supported** on FIFO queues — do not pass | Optional (0–900) |

---

## Testing: Mocking the Publisher

In unit tests, mock the publisher with `jest.fn()`:

```typescript
const mockPublisher: IEventPublisher<UserEventPayload> = {
  publish: jest.fn().mockResolvedValue(undefined),
};
```

Inject via `providers`:

```typescript
{
  provide: 'USER_EVENT_PUBLISHER',
  useValue: mockPublisher,
},
```

Assert the publish was called:

```typescript
expect(mockPublisher.publish).toHaveBeenCalledWith(
  expect.objectContaining({ eventType: 'USER_ACTIVATED', userId: '123' }),
);
```

> See the `write-domain-tests` skill for the full application service test setup.

---

## Quick Checklist

- [ ] Event payload Zod schema added to `packages/contracts/{domain}/src/schemas.ts`
- [ ] `{ENTITY}_EVENT_PUBLISHER` token constant defined in the NestJS module
- [ ] `useFactory` provider uses `SqsFifoEventPublisher` (default) or `SqsStandardEventPublisher` (explicit opt-out)
- [ ] `STAGE === 'local'` guard used in `useFactory` (never `NODE_ENV`)
- [ ] `IEventPublisher<T>` injected in application service (never the concrete class)
- [ ] `@Inject('{ENTITY}_EVENT_PUBLISHER')` decorator used
- [ ] Publish called **after** use-case success
- [ ] `.env.local` updated with `{DOMAIN}_SQS_QUEUE_NAME` and `{DOMAIN}_SQS_QUEUE_URL`
- [ ] `QUEUE_CONFIGS` entry added to `scripts/setup-localstack.ts` (`fifo: true` for default FIFO, omit or `fifo: false` for explicit Standard)
- [ ] `pnpm run localstack:setup:force` run (queue URL in output)
- [ ] `@mma/aws-sqs: workspace:*` dependency added; `pnpm install` run
- [ ] Unit tests mock `IEventPublisher<T>` with `{ publish: jest.fn() }`
