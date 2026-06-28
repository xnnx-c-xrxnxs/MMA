---
name: sqs-event-driven-service
description: Scaffold the complete internal NestJS layer structure for an SQS event-driven (consumer) microservice. Use this when creating a service that is triggered by SQS messages rather than HTTP requests. Produces no HTTP server, no Swagger, and no presentation layer. Covers main.ts, SqsLocalService, NormalizedSqsRecord interface, event handler application service with typed switch dispatch, event type constants, discriminated union Zod schemas, and module wiring.
---

# Scaffolding an SQS Event-Driven Service

> **This skill is for SQS consumer services only.** For HTTP API services use the `nestjs-service-layers` skill instead.

> **Intra-domain vs. cross-domain:** This skill covers the **base scaffolding** for any SQS consumer service and the **intra-domain** event patterns (consuming events from the same bounded context). For services that consume events **published by a different domain** (e.g. Order Event Handler consuming Product events), follow this skill for base scaffolding first, then apply the **`cross-domain-event-handler`** skill for import rules, handler wiring, and isolation guarantees.

Canonical reference: `apps/{domain}/{service}/src/`

For Nx workspace registration (project.json, tsconfig, webpack) follow the `nx-microservice-scaffold` skill first, applying the event-driven variant rules listed at the bottom of that skill.

---

## Required Information — Ask Before Starting

1. **Domain name** (e.g. `orders`, `notifications`) — determines the `apps/{domain}/` folder.
2. **Service name** (e.g. `order-event-handler-service`) — the Nx project name and folder.
3. **Which domain package does this service use?** (e.g. `@old-st/{domain}-domain`)
4. **SQS queue env var name** for the queue URL (e.g. `ORDER_EVENTS_SQS_QUEUE_URL`).
5. **SQS queue name** — the physical queue name used locally (e.g. `orders-events`). Becomes the default in `SqsLocalService`.
6. **What events must this service handle?** — list every event type name (e.g. `UPDATE_STATUS`, `ASSIGN_RULES`). These become the `{DOMAIN}_EVENTS` constant array and the discriminated union variants.
7. **What payload fields does each event carry?** — the field names and types per event. Used to define per-event payload interfaces in `domain/events/` and Zod schemas in `contracts/`.

---

## Two Runtime Modes

| Mode | How it runs | Triggered by |
|---|---|---|
| **Local** | `STAGE=local` → NestJS application context starts + `SqsLocalService.pollQueue()` long-polls LocalStack | Developer running `npx nx serve {service-name}` |
| **Lambda** | Exported `handler` function handles `event.Records` from the AWS SQS trigger | AWS Lambda invocation |

The application service (`{Domain}EventHandlerService`) is the **single shared entry point** for both paths. It never depends on `SQSClient` or Lambda types directly.

---

## Directory Structure

**Service app** (`apps/{domain}/{service}/src/`):
```
src/
  main.ts                                         ← bootstrap: local polling or Lambda handler
  app/
    app.module.ts                                 ← root NestJS module (imports domain module)
  application/
    interfaces/
      normalized-sqs-record.interface.ts          ← type boundary: decouples app from AWS types
      event-handler.interface.ts                  ← IEventHandler<T> contract for per-event handlers
    services/
      {domain}-event-handler.service.ts           ← thin dispatcher: parse + route only; no event logic
      handlers/
        {event-type}.handler.ts                   ← one file per event type (owns all logic for that event)
        index.ts                                  ← barrel re-export of all handlers
  infrastructure/
    sqs/
      sqs-local.service.ts                        ← LocalStack polling (infrastructure concern)
  modules/
    {domain}.module.ts                            ← wires all providers; no controllers array
```

**Domain package additions** (`packages/{domain}-domain/src/`):
```
domain/
  constants/
    {domain}-events.ts                            ← as const array + enum object (NEW)
    index.ts                                      ← re-export (UPDATE)
  events/
    {domain}-event-payloads.ts                    ← per-event payload interfaces (NEW)
    index.ts                                      ← barrel export (NEW)
```

**Contracts package addition** (`packages/contracts/{domain}/src/`):
```
  event-schemas.ts                                ← Zod discriminated union + inferred types (NEW)
```

> **No `presentation/` folder.** Event-driven services have no HTTP layer, no controllers, no pipes, and no `DomainExceptionFilter`.

---

## File Templates

### 1. `application/interfaces/normalized-sqs-record.interface.ts`

The single type used by **both** runtime paths. Application code never imports `SQSRecord` from `@types/aws-lambda` or `Message` from `@aws-sdk/client-sqs` directly.

```typescript
/**
 * Normalized SQS record — shared interface for both local polling and Lambda execution paths.
 *
 * Local path:  SqsLocalService maps AWS SDK `Message` (capital `Body`, `MessageId`, `ReceiptHandle`)
 *              → NormalizedSqsRecord before calling handleRecords().
 *
 * Lambda path: main.ts handler maps `SQSRecord` from @types/aws-lambda (lowercase `body`,
 *              `messageId`, `receiptHandle`) → NormalizedSqsRecord before calling handleRecords().
 *
 * The application service depends on this interface only — never on AWS SDK or Lambda types.
 */
export interface NormalizedSqsRecord {
  /** The raw message body string. Parsed to JSON inside the event handler service. */
  body: string;
  /** SQS message ID — useful for logging and deduplication. */
  messageId?: string;
  /** SQS receipt handle — used by SqsLocalService to delete the message after processing. */
  receiptHandle?: string;
}
```

---

### 2. `application/interfaces/event-handler.interface.ts`

The contract every per-event handler must satisfy. Keeps the dispatcher decoupled from concrete handler classes.

```typescript
/**
 * IEventHandler<TPayload>
 *
 * Contract for per-event handler services.
 * One implementing class exists per event type — each class owns all logic
 * for its specific event and can inject its own use cases independently.
 *
 * Rules:
 *   - Never import this interface in infrastructure or presentation code.
 *   - `messageId` is optional — used only for logging; never as business key.
 */
export interface IEventHandler<TPayload> {
  handle(payload: TPayload, messageId?: string): Promise<void>;
}
```

---

### 3. `application/services/handlers/{event-type}.handler.ts`

One file per event type. Each handler `implements IEventHandler<{EventType}Payload>`, injects only the use cases it needs, and owns all logic for that event.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import { {EventType}Payload } from '@old-st/{domain}-domain';
// import { SomeUseCase } from '@old-st/{domain}-domain';

/**
 * {EventType}Handler
 *
 * Handles the {DOMAIN}_EVENT_TYPE SQS event.
 * Inject only the use cases this specific event requires.
 */
@Injectable()
export class {EventType}Handler implements IEventHandler<{EventType}Payload> {
  constructor(
    // private readonly someUseCase: SomeUseCase,
  ) {}

  async handle(payload: {EventType}Payload, messageId?: string): Promise<void> {
    logger.info(
      `Handling [{EventType}] message ${messageId ?? '(no id)'}`,
    );
    // Implement event-specific logic here.
    // Delegate to injected use cases — never write business logic directly.
  }
}
```

> **Cross-domain handlers:** When consuming events from a **different domain**, use `Extract<>` to narrow the discriminated union to the specific event variant for this handler. See the `cross-domain-event-handler` skill for the full `Extract<>` typing pattern.

Create `application/services/handlers/index.ts` to barrel-export all handlers:

```typescript
export * from './{event-type}.handler';
// export * from './{other-event}.handler';
```

**Rules:**
- One file per event type — never merge two events into one handler class.
- Handler class name convention: `{PascalCaseEventType}Handler` (e.g. `UserDeletedHandler`, `OrderCreatedHandler`).
- Inject only the use cases the handler needs — not every use case for the domain.
- `handle()` rethrows errors to let the dispatcher propagate them to `SqsLocalService`.
- No parsing, no schema validation — the dispatcher handles that before calling `handle()`.

---

### 4. `application/services/{domain}-event-handler.service.ts`

**Thin dispatcher only** — parses the body, routes to a per-event handler. Contains zero event-specific logic. Adding a new event type means adding one new handler file and one new `case` here.

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { runWithCorrelationId } from '@old-st/telemetry';
import { {domain}DomainEventSchema, {Domain}EventTypeEnum } from '@old-st/contracts/{domain}';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { {EventType}Handler } from './handlers';
// import { {OtherEventType}Handler } from './handlers';

const logger = createLogger('{domain}-event-handler-service');

@Injectable()
export class {Domain}EventHandlerService {
  constructor(
    private readonly {eventType}Handler: {EventType}Handler,
    // private readonly {otherEventType}Handler: {OtherEventType}Handler,
  ) {}

  /**
   * Entry point for both local SQS polling and Lambda execution.
   * Processes each record independently — a failure on one record does not abort the batch.
   * Extracts correlationId from the raw body and wraps processing in runWithCorrelationId()
   * so all log lines within a record share the same correlation context.
   */
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
    const parseResult = {domain}DomainEventSchema.safeParse(
      JSON.parse(record.body),
    );

    if (!parseResult.success) {
      logger.error(
        `Invalid event shape [${record.messageId ?? '(no id)'}]`,
        { issues: parseResult.error.issues },
      );
      // Do NOT rethrow — the message will be re-enqueued after the visibility timeout.
      return;
    }

    const payload = parseResult.data;
    logger.info(
      `Dispatching [${payload.eventType}] message ${record.messageId ?? '(no id)'}`,
    );

    try {
      switch (payload.eventType) {
        case {Domain}EventTypeEnum.EVENT_A:
          await this.{eventType}Handler.handle(payload, record.messageId);
          break;

        // case {Domain}EventTypeEnum.EVENT_B:
        //   await this.{otherEventType}Handler.handle(payload, record.messageId);
        //   break;

        // Exhaustiveness guard — when a new event is added to USER_EVENTS,
        // add a matching case above. The Zod discriminated union in @old-st/contracts/{domain}
        // will reject payloads for unregistered event types before they reach this switch.
        default: {
          const unhandledEvent = payload as unknown as { eventType: string };
          logger.warn(`Unhandled event type: ${unhandledEvent.eventType}`);
        }
      }

      logger.info(
        `Successfully dispatched [${payload.eventType}] message ${record.messageId ?? '(no id)'}`,
      );
    } catch (error) {
      logger.error(
        `Failed to dispatch [${payload.eventType}] message ${record.messageId ?? '(no id)'}`,
        { messageId: record.messageId },
        error,
      );
      // Rethrow so SqsLocalService skips DeleteMessageCommand — message re-enqueues.
      throw error;
    }
  }
}
```

**Rules:**
- **Zero event logic in this file** — every `case` block is a single `await handler.handle(...)` call.
- `safeParse` instead of `parse` — never throw on body validation; log Zod issues and return early without deleting the message.
- `processRecord` rethrows caught handler errors so `SqsLocalService.processMessage()` skips `DeleteMessageCommand`.
- Per-record loop in `handleRecords` — one bad record does not abort the batch.
- Adding a new event: create a handler file → add it to `handlers/index.ts` → add one `case` here → provide in module.
- Use `createLogger()` from `@old-st/telemetry`, not `new Logger()` from `@nestjs/common` (Golden Rule #35).
- `correlationId` extraction happens in `handleRecords()` BEFORE Zod parsing — wrap each record's `processRecord()` in `runWithCorrelationId()` so all log lines within a record share the same correlation context.
- Return `void` from `handleRecords` — Lambda success/failure is signalled via the `handler` return value.

**Key import rule:** The dispatcher imports `{domain}DomainEventSchema` and `{Domain}EventTypeEnum` from `@old-st/contracts/{domain}` — never from the bare `@old-st/contracts` root or directly from `@old-st/{domain}-domain`. Contracts subpath is the single import point for both.

---

### 5. `infrastructure/sqs/sqs-local.service.ts`

Polls LocalStack for messages and delegates to the event handler service. Delete-on-success only.

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { NormalizedSqsRecord } from '../../application/interfaces/normalized-sqs-record.interface';
import { {Domain}EventHandlerService } from '../../application/services/{domain}-event-handler.service';

const logger = createLogger('{domain}-event-handler-service');

@Injectable()
export class SqsLocalService {
  private readonly sqsClient = new SQSClient({
    region: process.env.DEFAULT_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  });

  constructor(
    private readonly {domain}EventHandlerService: {Domain}EventHandlerService,
  ) {}

  async pollQueue(): Promise<void> {
    const queueUrl = process.env.{DOMAIN}_SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error('{DOMAIN}_SQS_QUEUE_URL is not defined');
    }
    logger.info(`Polling queue: ${queueUrl}`);

    while (true) {
      try {
        const { Messages } = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );

        if (Messages && Messages.length > 0) {
          for (const message of Messages) {
            await this.processMessage(message, queueUrl);
          }
        }
      } catch (error) {
        logger.error('Error polling SQS queue', {}, error);
      }

      // Yield the event loop between iterations to prevent starvation
      await new Promise((r) => setImmediate(r));
    }
  }

  private async processMessage(message: Message, queueUrl: string): Promise<void> {
    const normalized: NormalizedSqsRecord = {
      body: message.Body ?? '',
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle,
    };

    logger.info(`Processing message ${normalized.messageId ?? '(no id)'}`);

    // Attempt to process — only delete on success
    await this.{domain}EventHandlerService.handleRecords([normalized]);

    // Delete after successful processing to prevent redelivery
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }
}
```

**Rules:**
- `SQSClient` lives in `infrastructure/sqs/` — AWS clients are infrastructure concerns.
- Credentials hardcoded to `test` with env var override — LocalStack accepts any non-empty value.
- **Delete only on success**: `DeleteMessageCommand` is called after `handleRecords` resolves without throwing. If `handleRecords` throws (unexpected error outside per-record catch), the message remains in the queue and reappears after the visibility timeout.
- `await new Promise(r => setImmediate(r))` yields the Node.js event loop between iterations.
- Map SDK `Message` → `NormalizedSqsRecord` in this file. Application service sees only `NormalizedSqsRecord`.

---

### 6. `main.ts`

No HTTP server, no Swagger, no `@nestjs/platform-express`.

```typescript
import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Context, SQSRecord } from 'aws-lambda';
import { AppModule } from './app/app.module';
import { {Domain}EventHandlerService } from './application/services/{domain}-event-handler.service';
import { SqsLocalService } from './infrastructure/sqs/sqs-local.service';
import { NormalizedSqsRecord } from './application/interfaces/normalized-sqs-record.interface';

// ─── Cached NestJS application context (warm Lambda re-use) ──────────────────
let cachedApp: INestApplicationContext | undefined;

async function bootstrap(): Promise<INestApplicationContext> {
  if (!cachedApp) {
    cachedApp = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });
  }
  return cachedApp;
}

// ─── Local development — poll LocalStack SQS ─────────────────────────────────
if (process.env.STAGE === 'local') {
  // setImmediate defers polling start until after module initialisation completes
  setImmediate(async () => {
    const app = await bootstrap();
    const sqsLocalService = app.get(SqsLocalService);
    Logger.log('Starting local SQS polling...', '{Domain}Service');
    sqsLocalService.pollQueue();
  });
}

// ─── AWS Lambda handler ───────────────────────────────────────────────────────
export const handler = async (
  event: { Records: SQSRecord[] },
  _context: Context,
) => {
  const app = await bootstrap();
  const eventHandlerService = app.get({Domain}EventHandlerService);

  // Map Lambda SQSRecord (lowercase fields) → NormalizedSqsRecord
  const records: NormalizedSqsRecord[] = event.Records.map((r) => ({
    body: r.body,
    messageId: r.messageId,
    receiptHandle: r.receiptHandle,
  }));

  await eventHandlerService.handleRecords(records);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Records processed successfully' }),
  };
};
```

**Rules:**
- `cachedApp` guard ensures NestJS boots only once per Lambda container (warm reuse).
- `STAGE === 'local'` is the **only** branching condition — never `NODE_ENV` or `LOCALSTACK_STATUS`.
- `setImmediate` defers polling start so Nx `serve` watch mode finishes module init before polling begins.
- Lambda handler always exported, regardless of `STAGE`.
- No HTTP server, no `NestFactory.create`, no `app.listen`, no Swagger.

**Prisma variant — if this event handler's domain uses Prisma:**

Add `SecretsConfig.resolve()` before NestJS bootstrap in the Lambda handler:

```typescript
import { SecretsConfig } from '@old-st/aws-secrets';

export const handler = async (
  event: { Records: SQSRecord[] },
  _context: Context,
) => {
  // Hydrate database URL from Secrets Manager (only on cold start)
  await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL']);

  const app = await bootstrap();
  // ... rest of handler unchanged
};
```

This call must happen **before** `bootstrap()` because `PrismaConfig.getClient()` reads `process.env.{DOMAIN}_DATABASE_URL` during NestJS module initialization.

---

### 7. `app/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { {Domain}Module } from '../modules/{domain}.module';

@Module({
  imports: [{Domain}Module],
})
export class AppModule {}
```

No global filters, no controllers, no `DomainExceptionFilter` — there is no HTTP layer.

---

### 8. `modules/{domain}.module.ts`

Same provider factory pattern as an HTTP module (DynamoDB table + repository + use cases as `useFactory` providers), plus `SqsLocalService` and every per-event handler as plain class providers. **No `controllers` array.**

```typescript
import { Module } from '@nestjs/common';
import {
  I{Entity}Repository,
  // ... import use cases from '@old-st/{domain}-domain'
} from '@old-st/{domain}-domain';
import { Dynamo{Entity}Repository, {Entity}Schema } from '@old-st/{domain}-domain/infrastructure';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { {Domain}EventHandlerService } from '../application/services/{domain}-event-handler.service';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  // No controllers array — event-driven services have no HTTP layer
  providers: [
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.{DOMAIN}_DYNAMODB_TABLE_NAME || 'DefaultTable',
          {Entity}Schema,
        ),
    },
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (table: Table) => new Dynamo{Entity}Repository(table),
      inject: [DYNAMO_TABLE],
    },
    // Provide each use case individually — same pattern as HTTP modules
    // {
    //   provide: SomeUseCase,
    //   useFactory: (repo: I{Entity}Repository) => new SomeUseCase(repo),
    //   inject: [{ENTITY}_REPOSITORY],
    // },
    // Per-event handlers — one plain class provider per event type.
    // Add a new entry here every time a new event type is introduced.
    {EventType}Handler,
    // {OtherEventType}Handler,
    {Domain}EventHandlerService,
    SqsLocalService,
  ],
  exports: [{Domain}EventHandlerService],
})
export class {Domain}Module {}
```

**Prisma variant — if this event handler's domain uses Prisma + PostgreSQL:**

Replace the DynamoDB table + repository providers with Prisma equivalents:

```typescript
import { PrismaClient } from '@old-st/{domain}-domain/infrastructure';
import { Prisma{Entity}Repository } from '@old-st/{domain}-domain/infrastructure';
import { PrismaConfig } from '../infrastructure/config/prisma.config';

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => PrismaConfig.getClient(),
    },
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new Prisma{Entity}Repository(prisma),
      inject: [PRISMA_CLIENT],
    },
    // ... use cases, per-event handlers, event handler service, SqsLocalService — same as DynamoDB variant
  ],
  exports: [{Domain}EventHandlerService],
})
export class {Domain}Module {}
```

See the `prisma-service-wiring` skill for the complete `PrismaConfig` template and additional wiring requirements (engine path, webpack assets, init-runner COPY).

This section covers the three additional files required to implement typed event dispatch. Follow this pattern for every event-driven service.

### Step 1 — Domain constants: `packages/{domain}-domain/src/domain/constants/{domain}-events.ts`

Follow the same `as const` + `reduce` pattern used by `user-roles.ts` and `user-statuses.ts`. **Never use the `enum` keyword.**

```typescript
/**
 * {Domain} domain events — constants
 * Single source of truth for every event type this service handles.
 */
export const {DOMAIN}_EVENTS = [
  'EVENT_A',
  'EVENT_B',
  // ... add all event names
] as const;

export type {Domain}EventType = (typeof {DOMAIN}_EVENTS)[number];

// Derive enum object from array — avoids duplication and bans the `enum` keyword.
export const {Domain}EventTypeEnum = {DOMAIN}_EVENTS.reduce(
  (acc, event) => ({ ...acc, [event]: event }),
  {} as Record<{Domain}EventType, {Domain}EventType>,
);
```

Then re-export from `packages/{domain}-domain/src/domain/constants/index.ts`:

```typescript
export * from './{domain}-events';
```

And re-export from the domain package root barrel (`packages/{domain}-domain/src/index.ts`):
```typescript
export * from './domain/constants';
```

---

### Step 2 — Per-event payload interfaces: `packages/{domain}-domain/src/domain/events/{domain}-event-payloads.ts`

One interface per event. **No `data: Record<string, any>`** — every payload is fully typed.

```typescript
/**
 * Per-event payload interfaces for {Domain} domain events.
 *
 * Each interface maps 1-to-1 with a variant in the Zod discriminated union
 * defined in packages/contracts/{domain}/src/event-schemas.ts.
 *
 * Rules:
 *   - No NestJS decorators, no Zod imports — pure TypeScript interfaces.
 *   - Field names must exactly match the Zod schema variant field names.
 *   - Do NOT use `data: Record<string, any>` — define concrete fields for each event.
 */

export interface EventAPayload {
  eventType: 'EVENT_A';
  fieldOne: string;
  fieldTwo: number;
}

export interface EventBPayload {
  eventType: 'EVENT_B';
  id: string;
}

// Union type over all payload variants — matches the Zod discriminated union.
export type {Domain}EventPayload = EventAPayload | EventBPayload;
```

Create `packages/{domain}-domain/src/domain/events/index.ts`:

```typescript
export * from './{domain}-event-payloads';
```

Add to `packages/{domain}-domain/src/domain/index.ts` (or wherever the domain barrel is):
```typescript
export * from './events';
```

---

### Step 3 — Zod discriminated union: `packages/contracts/{domain}/src/event-schemas.ts`

Validation schemas live in `contracts/`, same rule as HTTP request/response schemas. Re-exports the domain constants so consumers only import from `@old-st/contracts/{domain}`.

```typescript
import { z } from 'zod';
import { {Domain}EventTypeEnum } from '@old-st/{domain}-domain';

// Re-export constants so consumers only need to import from @old-st/contracts/{domain}
export { {Domain}EventTypeEnum };
export type { {Domain}EventType } from '@old-st/{domain}-domain';

// ─── Per-variant schemas ──────────────────────────────────────────────────────
// Each object schema must include `eventType: z.literal(...)` as the discriminant
// field. All other fields are specific to that event.

const eventASchema = z.object({
  eventType: z.literal({Domain}EventTypeEnum.EVENT_A),
  fieldOne: z.string(),
  fieldTwo: z.number(),
});

const eventBSchema = z.object({
  eventType: z.literal({Domain}EventTypeEnum.EVENT_B),
  id: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────
// z.discriminatedUnion uses the 'eventType' discriminant to skip irrelevant
// variants — faster than z.union for large event sets.
export const {domain}DomainEventSchema = z.discriminatedUnion('eventType', [
  eventASchema,
  eventBSchema,
]);

export type {Domain}DomainEvent = z.infer<typeof {domain}DomainEventSchema>;
```

Export from `packages/contracts/{domain}/src/index.ts`:
```typescript
export * from './event-schemas';
```

**Rules:**
- Use `z.literal({Domain}EventTypeEnum.EVENT_X)` — **never a raw string literal** like `z.literal('EVENT_A')`; the enum object is the single source of truth.
- `z.discriminatedUnion` requires every variant to have the discriminant field (`eventType`) as a `z.literal`. No variant may omit it.
- Adding a new event: add it to `{DOMAIN}_EVENTS` → add a payload interface → add a Zod variant → add a `case` to the switch. TypeScript will error at each missed step.

---

### Step 4 — Updated application service imports

Update `{domain}-event-handler.service.ts` imports to bring in the Zod schema, enum, and per-event handlers:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { {domain}DomainEventSchema, {Domain}EventTypeEnum } from '@old-st/contracts/{domain}';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { {EventType}Handler } from './handlers';
// import { {OtherEventType}Handler } from './handlers';
```

---

## Environment Variables (`.env.local` additions)

Add these for each new event-driven service:

```dotenv
# ─── SQS queue (event-driven services) ──────────────────────────────────────
# Queue URL for local polling via LocalStack.
# The region segment must match DEFAULT_REGION in .env.local.
# FIFO is the default — the URL must end in .fifo when fifo: true in QUEUE_CONFIGS.
{DOMAIN}_SQS_QUEUE_URL=http://sqs.{DEFAULT_REGION_VALUE}.localhost.localstack.cloud:4566/000000000000/{queue-name}.fifo
# Queue name — used by setup-localstack.ts to create the queue (base name, without .fifo suffix)
{DOMAIN}_SQS_QUEUE_NAME={queue-name}
```

> `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`, `LOCALSTACK_ENDPOINT`, `DEFAULT_REGION`, and `STAGE=local` are already in `.env.local` from the base setup. Do **not** add `AWS_DEFAULT_REGION` — `DEFAULT_REGION` is the single source of truth for the region in this workspace.

**Notes:**
- `{DOMAIN}_SQS_QUEUE_URL` local value follows the DNS-based LocalStack SQS pattern: `http://sqs.{region}.localhost.localstack.cloud:4566/000000000000/{queue-name}.fifo`. Replace `{region}` with the value of `DEFAULT_REGION` (e.g. `eu-west-2`). The `000000000000` is the LocalStack fake account ID. The region in the URL and `DEFAULT_REGION` **must match**.
- The `.fifo` suffix on the URL is the **default** — omit it only for explicit Standard queue opt-out (`fifo: false` in `QUEUE_CONFIGS`).
- Event-driven services do **not** register a `{DOMAIN}_SERVICE_PORT` or `API_{DOMAIN}_URL` — there is no HTTP server.

---

## LocalStack Queue Setup

After adding env vars, register the queue in `scripts/setup-localstack.ts`:

```typescript
// Inside QUEUE_CONFIGS array:
{
  queueNameEnvVar: '{DOMAIN}_SQS_QUEUE_NAME',
  queueNameDefault: '{queue-name}',
  description: '{domain}-event-handler-service — processes {domain} domain events',
  fifo: true, // FIFO is the default
},
```

Then provision it:

```bash
pnpm run localstack:setup:force
```

Verify the queue exists:

```bash
pnpm run localstack:status
```

---

## Nx Scaffold Rules (Event-Driven Variant)

Follow the `nx-microservice-scaffold` skill for all Nx project files (`project.json`, `tsconfig.*`, `webpack.config.js`, `jest.config.cts`) with these differences:

| Step | API service | Event-driven service |
|---|---|---|
| Port registration | Required (claim next port in §7.1) | **Skip** — no HTTP server |
| `@nestjs/swagger` | Install | **Do not install** |
| `@aws-sdk/client-sqs` | Not needed | **Install** |
| `@types/aws-lambda` | Not needed | **Install** |
| VS Code task | Add `Service: Serve {service-name}` | Add `Service: Serve {service-name}` (same pattern) |

```bash
# Install runtime dependencies
pnpm add @aws-sdk/client-sqs --filter {service-name}

# Install dev-only type definitions
pnpm add -D @types/aws-lambda --filter {service-name}
```

---

## Checklist

**Domain package (`packages/{domain}-domain`)**
- [ ] Create `domain/constants/{domain}-events.ts` — `as const` array + `reduce` enum object
- [ ] Update `domain/constants/index.ts` — re-export the new events constants
- [ ] Create `domain/events/{domain}-event-payloads.ts` — one interface per event, no `any`
- [ ] Create `domain/events/index.ts` — barrel export
- [ ] Update domain barrel (`src/index.ts`) — export from `./domain/events`

**Contracts package (`packages/contracts`)**
- [ ] Create `src/{domain}/event-schemas.ts` — Zod discriminated union (`z.discriminatedUnion`)
- [ ] Update `src/{domain}/index.ts` or `src/index.ts` — export from `event-schemas.ts`

**Service app (`apps/{domain}/{service}/src`)**
- [ ] Read the `nx-microservice-scaffold` skill and apply event-driven variant rules (no port, no swagger deps)
- [ ] Create `application/interfaces/normalized-sqs-record.interface.ts`
- [ ] Create `application/interfaces/event-handler.interface.ts` — `IEventHandler<T>` contract
- [ ] Create `application/services/handlers/{event-type}.handler.ts` — one file per event type, `implements IEventHandler<{EventType}Payload>`
- [ ] Create `application/services/handlers/index.ts` — barrel re-export of all handlers
- [ ] Create `application/services/{domain}-event-handler.service.ts` — thin dispatcher (`safeParse` + `switch`; each `case` delegates to a handler)
- [ ] Create `infrastructure/sqs/sqs-local.service.ts`
- [ ] Create `main.ts` (no HTTP, `STAGE=local` branching, cached app context)
- [ ] Create `app/app.module.ts`
- [ ] Create `modules/{domain}.module.ts` (no `controllers` array; add one plain provider per handler class)

**Infrastructure + environment**
- [ ] Add `{DOMAIN}_SQS_QUEUE_URL` and `{DOMAIN}_SQS_QUEUE_NAME` to `.env.local` (use `DEFAULT_REGION` value for the region segment in the URL — do **not** add `AWS_DEFAULT_REGION`)
- [ ] Add `QUEUE_CONFIGS` entry to `scripts/setup-localstack.ts`
- [ ] Run `pnpm run localstack:setup:force` to provision the queue
- [ ] Add `Service: Serve {service-name}` VS Code task and append to `Dev: Start All`

**Tests**
- [ ] Add tests for the event handler application service (mocked use cases, per-event `handleRecords` cases, invalid body case, unhandled event type case)
