---
name: cross-domain-event-handler
description: Add a cross-domain SQS event consumer — a service that reacts to events published by a different bounded context. Use this when a domain needs to react to lifecycle events from another domain (e.g. Order service reacting to product price changes). Builds on `sqs-event-driven-service` for base scaffolding and adds cross-domain isolation rules.
---

# Cross-Domain Event Handler (Consumer)

> **Use this when a service consumes SQS events published by a different bounded context.** For intra-domain events (same domain, same contracts) use `sqs-event-driven-service` directly. For synchronous cross-service validation use the `sync-cross-service-call` skill.

Canonical reference: Order Event Handler consuming Product lifecycle events (to be implemented).

---

## Intra-Domain vs. Cross-Domain — Key Differences

| Concern | Intra-domain (`sqs-event-driven-service`) | Cross-domain (this skill) |
|---|---|---|
| Event schemas import path | `@old-st/contracts/{own-domain}` | `@old-st/contracts/{publishing-domain}` |
| Event type constants import | `@old-st/{own-domain}-domain` | `@old-st/contracts/{publishing-domain}` |
| Domain package dependency | Only own domain | Own domain **+ contracts of publishing domain** |
| Compile-time coupling | None (everything is internal) | **Contracts only** — never import from `@old-st/{publishing-domain}-domain` directly |
| Who defines the event shape? | Publishing domain (same as consuming) | **Publishing domain** — consumer reads, never modifies |
| Handler writes to | Own domain's repository | Own domain's repository |
| Handler reads from | Own domain's repository + optional use cases | Own domain's repository + optional use cases |

**Golden Rule:** The cross-domain event handler may **import from the publishing domain's contracts** (`@old-st/contracts/{publishing-domain}`) but **never from its domain package** (`@old-st/{publishing-domain}-domain`). The consumer treats event schemas as a Published Language — an API contract it reads but does not own.

---

## Required Information — Ask Before Starting

1. **Consuming domain** (e.g. `orders`) — the domain that reacts to events.
2. **Consuming service name** (e.g. `order-event-handler-service`) — the Nx project name.
3. **Publishing domain** (e.g. `products`) — the domain that publishes events.
4. **Which events does this service consume?** — list event type names from the publishing domain (e.g. `PRODUCT_PRICE_CHANGED`, `PRODUCT_DISCONTINUED`).
5. **What should happen for each event?** — the business reaction (e.g. "update denormalized product snapshot in order items").
6. **Does the consuming domain package already exist?** — if not, use `new-domain-package` first.
7. **Does the consuming service already exist?** — if not, use `sqs-event-driven-service` for base scaffolding first.

---

## Prerequisites

Before following this skill, ensure:

- The **publishing domain** already has event type constants and event schemas defined (see `sqs-event-publisher` skill).
- The **consuming service** has been scaffolded with `sqs-event-driven-service` (or will be scaffolded now).
- Contracts subpath exports exist for the publishing domain (`@old-st/contracts/{publishing-domain}` — see `contracts-subpath-imports` skill).

---

## Architecture Overview

```
packages/contracts/{publishing-domain}/src/
  event-schemas.ts                    ← Zod schemas + event types (OWNED BY PUBLISHER)
  index.ts                            ← exports event schemas + types

apps/{consuming-domain}/{consuming-service}/
  src/
    application/
      services/
        {consuming-domain}-event-handler.service.ts   ← dispatcher
        handlers/
          {publishing-event}.handler.ts               ← per-event handler
          index.ts
    infrastructure/
      sqs/
        sqs-local.service.ts
    modules/
      {consuming-domain}.module.ts
```

The consuming service's handlers import Zod schemas from the publishing domain's contracts subpath and write to the consuming domain's own repository.

---

## Step 1 — Verify Publishing Domain Contracts

The publishing domain must already export:

In `packages/contracts/{publishing-domain}/src/event-schemas.ts`:

```typescript
import { z } from 'zod';

// Event type enum (as const array + enum object)
export const {PUBLISHING_DOMAIN}_EVENT_TYPES = [
  '{PUBLISHING_DOMAIN}_ENTITY_CREATED',
  '{PUBLISHING_DOMAIN}_ENTITY_UPDATED',
  '{PUBLISHING_DOMAIN}_ENTITY_DELETED',
] as const;

export const {PublishingDomain}EventTypeEnum = {
  ENTITY_CREATED: '{PUBLISHING_DOMAIN}_ENTITY_CREATED',
  ENTITY_UPDATED: '{PUBLISHING_DOMAIN}_ENTITY_UPDATED',
  ENTITY_DELETED: '{PUBLISHING_DOMAIN}_ENTITY_DELETED',
} as const;

// Per-event Zod schemas
const {publishingEntity}CreatedSchema = z.object({
  eventType: z.literal({PublishingDomain}EventTypeEnum.ENTITY_CREATED),
  {publishingEntity}Id: z.string(),
  correlationId: z.string().optional(), // auto-injected by SQS publisher
  // ... event-specific fields
});

// Discriminated union
export const {publishingDomain}DomainEventSchema = z.discriminatedUnion('eventType', [
  {publishingEntity}CreatedSchema,
  {publishingEntity}UpdatedSchema,
  {publishingEntity}DeletedSchema,
]);

export type {PublishingDomain}DomainEvent = z.infer<typeof {publishingDomain}DomainEventSchema>;
```

In `packages/contracts/{publishing-domain}/src/index.ts`:
```typescript
export * from './event-schemas';
```

**If these don't exist yet**, create them using the `sqs-event-publisher` and `add-contracts` skills first.

---

## Step 2 — Import Publishing Domain Contracts in the Consumer

The consuming service imports **only from the contracts subpath** — never from the publishing domain package.

```typescript
// ✅ CORRECT — import from publishing domain's contracts subpath
import {
  {publishingDomain}DomainEventSchema,
  {PublishingDomain}EventTypeEnum,
  type {PublishingDomain}DomainEvent,
} from '@old-st/contracts/{publishing-domain}';

// ❌ FORBIDDEN — never import from publishing domain package
import { ... } from '@old-st/{publishing-domain}-domain';

// ❌ FORBIDDEN — never import from bare contracts root
import { ... } from '@old-st/contracts';
```

**Why:** The consumer depends on the **Published Language** (event schemas in contracts), not the publishing domain's internal types. This prevents compile-time coupling — the publishing domain can refactor its internals without breaking consumers.

---

## Step 3 — Create Per-Event Handlers

Each event gets its own handler file in `application/services/handlers/`.

File: `apps/{consuming-domain}/{service}/src/application/services/handlers/{publishing-event}.handler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../interfaces/event-handler.interface';
// Import the inferred event type from publishing domain's contracts
import type { {PublishingDomain}DomainEvent } from '@old-st/contracts/{publishing-domain}';
// Import consuming domain's use cases
import { SomeUseCase } from '@old-st/{consuming-domain}-domain';

// Extract the specific event variant from the discriminated union.
// This narrows the payload type to only the fields relevant to this handler.
type {EventName}Payload = Extract<
  {PublishingDomain}DomainEvent,
  { eventType: '{PUBLISHING_DOMAIN}_EVENT_NAME' }
>;

/**
 * Handles {PUBLISHING_DOMAIN}_EVENT_NAME events from the {publishing} bounded context.
 *
 * Cross-domain handler: reads event data from @old-st/contracts/{publishing-domain},
 * writes to {consuming-domain}'s own repository via use cases.
 */
@Injectable()
export class {PublishingEvent}Handler implements IEventHandler<{EventName}Payload> {
  private readonly logger = new Logger({PublishingEvent}Handler.name);

  constructor(
    private readonly someUseCase: SomeUseCase,
  ) {}

  async handle(payload: {EventName}Payload, messageId?: string): Promise<void> {
    this.logger.log(
      `Handling [${payload.eventType}] from {publishing-domain} — message ${messageId ?? '(no id)'}`,
    );

    // Extract only the fields the consuming domain cares about
    // Map publishing domain's language to consuming domain's language
    await this.someUseCase.execute({
      // ... map event payload fields to use case input
    });
  }
}
```

### `Extract<>` Typing Pattern

Use TypeScript's `Extract<>` utility type to narrow the discriminated union to a single event variant:

```typescript
// Full union (from contracts): ProductDomainEvent = PriceChanged | Deactivated | Discontinued
// Narrowed type for this specific handler:
type PriceChangedPayload = Extract<ProductDomainEvent, { eventType: 'PRODUCT_PRICE_CHANGED' }>;
// Result: { eventType: 'PRODUCT_PRICE_CHANGED'; productId: string; oldPrice: number; newPrice: number; occurredAt: string }
```

**Why:** The discriminated union contains all event variants. Without `Extract<>`, the handler would have to deal with fields from all variants. With `Extract<>`, the handler gets a precise type with only the fields for its specific event.

**Rules:**
- Handler injects **consuming domain's use cases** — never publishing domain's.
- Handler reads event payload typed by the **publishing domain's contracts**.
- Handler maps publishing domain's field names/concepts to consuming domain's language (Anti-Corruption at the handler boundary).
- One handler per event type — never combine multiple events in one handler.
- Always use `Extract<{Union}, { eventType: '{LITERAL}' }>` for handler payload typing — never cast or use `as`.

---

## Step 4 — Wire the Dispatcher

The event handler service (dispatcher) is the same pattern as `sqs-event-driven-service`, but imports come from the **publishing domain's contracts**.

File: `apps/{consuming-domain}/{service}/src/application/services/{consuming-domain}-event-handler.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { runWithCorrelationId } from '@old-st/telemetry';
// Schemas from PUBLISHING domain's contracts
import {
  {publishingDomain}DomainEventSchema,
  {PublishingDomain}EventTypeEnum,
} from '@old-st/contracts/{publishing-domain}';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { {PublishingEvent}Handler } from './handlers';

const logger = createLogger('{consuming-domain}-event-handler-service');

@Injectable()
export class {ConsumingDomain}EventHandlerService {
  constructor(
    private readonly {publishingEvent}Handler: {PublishingEvent}Handler,
  ) {}

  async handleRecords(records: NormalizedSqsRecord[]): Promise<void> {
    for (const record of records) {
      // Extract correlationId from raw body BEFORE Zod parsing
      let correlationId: string | undefined;
      try {
        const raw = JSON.parse(record.body);
        correlationId = raw.correlationId;
      } catch {
        // body will fail Zod parse below — correlationId stays undefined
      }

      if (correlationId) {
        await runWithCorrelationId(correlationId, () => this.processRecord(record));
      } else {
        await this.processRecord(record);
      }
    }
  }

  private async processRecord(record: NormalizedSqsRecord): Promise<void> {
    // Parse against PUBLISHING domain's discriminated union schema
    const parseResult = {publishingDomain}DomainEventSchema.safeParse(
      JSON.parse(record.body),
    );

    if (!parseResult.success) {
      logger.error(
        `Invalid event shape from {publishing-domain} [${record.messageId ?? '(no id)'}]`,
        { issues: parseResult.error.issues },
      );
      return;
    }

    const payload = parseResult.data;
    logger.info(
      `Dispatching [{payload.eventType}] from {publishing-domain} — message ${record.messageId ?? '(no id)'}`,
    );

    try {
      switch (payload.eventType) {
        case {PublishingDomain}EventTypeEnum.ENTITY_UPDATED:
          await this.{publishingEvent}Handler.handle(payload, record.messageId);
          break;

        default: {
          const unhandled = payload as unknown as { eventType: string };
          logger.warn(`Unhandled {publishing-domain} event: ${unhandled.eventType}`);
        }
      }
    } catch (error) {
      logger.error(
        `Failed to process [{payload.eventType}] message ${record.messageId ?? '(no id)'}`,
        { messageId: record.messageId },
        error,
      );
      throw error;
    }
  }
}
```

**Key difference from intra-domain:** The `safeParse` and `switch` use schemas/enums from `@old-st/contracts/{publishing-domain}`, not from the consuming domain's own contracts.

---

## Step 5 — Wire Module Providers

File: `apps/{consuming-domain}/{service}/src/modules/{consuming-domain}.module.ts`

```typescript
import { Module } from '@nestjs/common';
import {
  I{Entity}Repository,
  SomeUseCase,
} from '@old-st/{consuming-domain}-domain';
import { Dynamo{Entity}Repository, {Entity}Schema } from '@old-st/{consuming-domain}-domain/infrastructure';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { {ConsumingDomain}EventHandlerService } from '../application/services/{consuming-domain}-event-handler.service';
import { {PublishingEvent}Handler } from '../application/services/handlers';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  // No controllers — event-driven service
  providers: [
    // --- Infrastructure ---
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.{CONSUMING_DOMAIN}_DYNAMODB_TABLE_NAME || 'OldSTTable',
          {Entity}Schema,
        ),
    },
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (table: Table) => new Dynamo{Entity}Repository(table),
      inject: [DYNAMO_TABLE],
    },

    // --- Use Cases (consuming domain only) ---
    {
      provide: SomeUseCase,
      useFactory: (repo: I{Entity}Repository) => new SomeUseCase(repo),
      inject: [{ENTITY}_REPOSITORY],
    },

    // --- Per-event handlers ---
    {PublishingEvent}Handler,

    // --- Dispatcher ---
    {ConsumingDomain}EventHandlerService,

    // --- Local SQS polling ---
    SqsLocalService,
  ],
  exports: [{ConsumingDomain}EventHandlerService],
})
export class {ConsumingDomain}Module {}
```

**Rules:**
- Per-event handlers are provided as plain classes (they use `@Injectable()` + constructor injection).
- Use cases from the **consuming domain only** — never import/provide use cases from the publishing domain.
- `SqsLocalService` is provided as a plain class (it injects `{ConsumingDomain}EventHandlerService`).

---

## Step 6 — Environment Variables

Add to `.env.local`:

```env
# Cross-domain SQS queue — {consuming-domain} consumes events from {publishing-domain}
# FIFO is the default — the URL must end in .fifo when fifo: true in QUEUE_CONFIGS
{CONSUMING_DOMAIN}_SQS_QUEUE_URL=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/{queue-name}.fifo
{CONSUMING_DOMAIN}_SQS_QUEUE_NAME={queue-name}
```

**Queue naming convention for cross-domain:** `{publishing-domain}-events-for-{consuming-domain}` (e.g. `product-events-for-orders`). This makes it clear who publishes and who consumes.

Add a `QUEUE_CONFIGS` entry to `scripts/setup-localstack.ts`:

```typescript
{
  queueName: '{queue-name}',
  fifo: true, // FIFO is the default for cross-domain events
},
```

Run `pnpm run localstack:setup:force` to create the queue.

---

## Step 7 — Update `.env.local.example`

Use the `generate-env-local` skill (add-missing-keys mode) to update `.env.local.example` with the new queue variables.

---

## Testing Cross-Domain Handlers

Unit tests for cross-domain handlers follow the same mock pattern as intra-domain handlers — mock the use cases, construct the handler, call `handle()`.

```typescript
import { {PublishingEvent}Handler } from './handlers/{publishing-event}.handler';
import { {PublishingDomain}EventTypeEnum } from '@old-st/contracts/{publishing-domain}';

describe('{PublishingEvent}Handler', () => {
  let handler: {PublishingEvent}Handler;
  const mockUseCase = { execute: jest.fn() };

  beforeEach(() => {
    handler = new {PublishingEvent}Handler(mockUseCase as any);
    jest.clearAllMocks();
  });

  it('should process {event type} event and call use case', async () => {
    const payload = {
      eventType: {PublishingDomain}EventTypeEnum.ENTITY_UPDATED,
      {publishingEntity}Id: 'prod_123',
      // ... event fields
    };

    await handler.handle(payload, 'msg-123');

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        // ... expected mapped fields
      }),
    );
  });
});
```

For dispatcher integration tests, test the full `processRecord` path with a serialized JSON body:

```typescript
const record: NormalizedSqsRecord = {
  body: JSON.stringify({
    eventType: '{PUBLISHING_DOMAIN}_ENTITY_UPDATED',
    {publishingEntity}Id: 'prod_123',
    // ...
  }),
  messageId: 'msg-test-1',
};

await service.handleRecords([record]);
expect(mockHandler.handle).toHaveBeenCalled();
```

---

## Common Mistakes to Avoid

- **Importing from `@old-st/{publishing-domain}-domain`** — only import from `@old-st/contracts/{publishing-domain}`. The consumer never depends on the publisher's domain internals.
- **Modifying the publishing domain's event schemas from the consumer** — the publisher owns the event contract. If you need different fields, request a schema change in the publishing domain.
- **Writing directly to the publishing domain's table** — handlers always write to the consuming domain's own repository. Cross-domain data stays denormalized.
- **Adding consuming domain event types to the publishing domain's enum** — each domain defines its own event types. The consumer reacts to the publisher's events, not the other way around.
- **Forgetting to add the contracts subpath dependency** — the consuming service's `tsconfig` must resolve `@old-st/contracts/{publishing-domain}`.

---

## Cross-Domain Event Flow (Complete Picture)

```
┌─────────────────────┐     SQS      ┌──────────────────────────────┐
│ Publishing Service   │──→ Queue ──→│ Consuming Event Handler      │
│ (e.g. Product API)  │              │ (e.g. Order Event Handler)   │
└─────────────────────┘              └──────────────────────────────┘
        │                                       │
        │ publishes via                         │ reads events from
        │ SqsEventPublisher                     │ SqsLocalService (local)
        │                                       │ Lambda trigger (AWS)
        ▼                                       ▼
  @old-st/contracts/{publishingDomain}     @old-st/contracts/{publishingDomain}
  (event-schemas.ts)                       (same schemas — read only)
                                                │
                                                │ writes to
                                                ▼
                                       @old-st/{consumingDomain}-domain
                                       (own repository)
```

Both sides depend on the **same contracts subpath** — the publishing domain's event schemas. The publisher writes events matching the schema; the consumer validates incoming events against the same schema. Neither side depends on the other's domain internals.

---

## Relationship to Other Skills

| Skill | When to use alongside this one |
|---|---|
| `sqs-event-driven-service` | Base scaffolding if the consuming service doesn't exist yet |
| `sqs-event-publisher` | Setting up the publishing side (event constants, schemas, publisher wiring) |
| `add-contracts` | Adding or updating event schemas in the publishing domain's contracts |
| `contracts-subpath-imports` | Ensuring the publishing domain's contracts subpath is properly configured |
| `nx-microservice-scaffold` | Registering the consuming service as an Nx project |
| `new-use-case` | Creating use cases in the consuming domain that handlers invoke |
