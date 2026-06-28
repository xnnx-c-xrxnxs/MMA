---
name: choreography-saga
description: Implement a choreography saga — a multi-step asynchronous workflow across two bounded contexts with request→response event cycle and eventual state resolution. Use this when an operation requires async coordination between domains (e.g. order creation triggers product validation → validation result resolves order status).
---

# Choreography Saga (Multi-Step Cross-Domain Workflow)

> **Use this when** an operation triggers async validation or processing in another domain, and the initiating domain must wait for a result event before resolving its state. This is a **request→response** pattern over SQS — not fire-and-forget.

Canonical reference: Order creation → Product validation saga (Order API → Product Event Handler → Order Event Handler).

---

## When to Use (vs. Other Patterns)

| Question | Answer → Use This |
|---|---|
| Can the operation proceed without an answer from the other domain? | **No** — but the answer is deferred (eventual, not synchronous) |
| Is synchronous validation acceptable? | **No** — too slow, coupling too tight, or downstream work is heavy |
| Is fire-and-forget sufficient? | **No** — the initiating domain needs a success/failure resolution |
| Are two bounded contexts involved? | **Yes** — each domain owns its own data and publishes its own events |

If the answer is synchronous and lightweight, use `sync-cross-service-call` instead.
If no response is needed, use `cross-domain-event-handler` (fire-and-forget).

---

## Architecture Overview

```
┌─────────────────┐    ORDER_CREATED     ┌──────────────────────────┐
│  Order API      │ ──────────────────►  │  Product Event Handler   │
│  (Initiator)    │    product-events     │  (Responder)             │
│                 │    queue              │                          │
│  DRAFT status   │                      │  Validates products      │
└─────────────────┘                      │  via own repository      │
                                         └────────┬─────────────────┘
                                                   │
                                    PRODUCT_VALIDATION_SUCCEEDED
                                        or PRODUCT_VALIDATION_FAILED
                                                   │
                                            order-events queue
                                                   │
                                                   ▼
                                  ┌──────────────────────────────┐
                                  │  Order Event Handler         │
                                  │  (Resolver)                  │
                                  │                              │
                                  │  DRAFT → PENDING             │
                                  │  or DRAFT → VALIDATION_FAILED│
                                  └──────────────────────────────┘
```

**Three roles:**
1. **Initiator** — starts the saga by publishing a request event after creating the entity in a provisional state.
2. **Responder** — receives the request event, performs domain-specific work, publishes a result event (success or failure).
3. **Resolver** — receives the result event, transitions the initiating entity to its final state.

**Queue topology — consumer-owned inbox:**
- `product-events` — inbox for the product domain (Product Event Handler consumes from here)
- `order-events` — inbox for the order domain (Order Event Handler consumes from here)

---

## Required Information — Ask Before Starting

1. **Initiating domain** (e.g. `orders`) and **service** (e.g. `order-api-service`).
2. **Responding domain** (e.g. `products`) and **service** (e.g. `product-event-handler-service`).
3. **Resolving service** (e.g. `order-event-handler-service`) — usually in the initiating domain.
4. **Provisional status** the entity starts in (e.g. `DRAFT`).
5. **Success status** after validation passes (e.g. `PENDING`).
6. **Failure status** after validation fails (e.g. `VALIDATION_FAILED`).
7. **Request event type** (e.g. `ORDER_CREATED`) — what triggers the remote validation.
8. **Success result event type** (e.g. `PRODUCT_VALIDATION_SUCCEEDED`).
9. **Failure result event type** (e.g. `PRODUCT_VALIDATION_FAILED`).
10. **What does the responder validate?** (e.g. products exist, are active, prices match).
11. **Does the responder service already exist?** If not, scaffold with `sqs-event-driven-service` + `nx-microservice-scaffold` first.
12. **Does the resolver service already exist?** If not, scaffold with `sqs-event-driven-service` first.

---

## Prerequisites and Related Skills

| Prerequisite | Skill |
|---|---|
| Scaffold a new event handler service | `sqs-event-driven-service` + `nx-microservice-scaffold` |
| Add event publisher to an API service | `sqs-event-publisher` |
| Consume cross-domain events | `cross-domain-event-handler` |
| Create new domain use cases | `new-use-case` |
| Define event schemas in contracts | `add-contracts` |
| Add domain entity state transitions | `domain-business-rules` |
| Wire NestJS module providers | `nestjs-service-layers` or `prisma-service-wiring` |

---

## Implementation Steps

### Step 1 — Add Provisional + Failure Statuses to Domain Constants

Add the success and failure statuses to the initiating domain's status constants if they don't already exist.

```typescript
// packages/{initiating-domain}-domain/src/domain/constants/{entity}-statuses.ts
export const ORDER_STATUSES = [
  'DRAFT',              // ← provisional (start here)
  'PENDING',            // ← success resolution
  'CONFIRMED',
  'CANCELLED',
  'VALIDATION_FAILED',  // ← failure resolution (terminal)
] as const;
```

**Rule:** The entity starts in the provisional status (`DRAFT`), not the final status. The saga result determines the transition.

### Step 2 — Add Domain Entity Methods for Saga Resolution

Add transition methods and guards to the entity. Follow the `domain-business-rules` skill.

```typescript
// In the order entity:

approveProductValidation(): void {
  if (this.props.status !== OrderStatusEnum.DRAFT) {
    throw new CannotApproveProductValidationError(this.props.orderId, this.props.status);
  }
  this.props.status = OrderStatusEnum.PENDING;
  this.props.updatedAt = new Date();
}

failValidation(): void {
  if (this.props.status !== OrderStatusEnum.DRAFT) {
    throw new CannotFailValidationError(this.props.orderId, this.props.status);
  }
  this.props.status = OrderStatusEnum.VALIDATION_FAILED;
  this.props.updatedAt = new Date();
}
```

**Rules:**
- Both methods guard on the provisional status only.
- Each method throws a unique typed domain exception.
- Terminal failure states (like `VALIDATION_FAILED`) should be blocked from further transitions (e.g. `cancel()` should reject them).

### Step 3 — Add Request Event Type Constants

In the initiating domain:

```typescript
// packages/{initiating-domain}-domain/src/domain/constants/{entity}-event-types.ts
export const ORDER_EVENTS = ['ORDER_CREATED'] as const;

export type OrderEventType = (typeof ORDER_EVENTS)[number];

export const OrderEventTypeEnum = ORDER_EVENTS.reduce(
  (acc, event) => ({ ...acc, [event]: event }),
  {} as Record<OrderEventType, OrderEventType>,
);
```

### Step 4 — Add Response Event Type Constants

In the responding domain, add success and failure event types:

```typescript
// packages/{responding-domain}-domain/src/domain/constants/{entity}-event-types.ts
// Add to the existing array:
export const PRODUCT_EVENTS = [
  // ... existing events
  'PRODUCT_VALIDATION_SUCCEEDED',
  'PRODUCT_VALIDATION_FAILED',
] as const;
```

### Step 5 — Define Event Schemas in Contracts

Follow the `add-contracts` skill. Create event schemas in both domains' contracts:

**Initiating domain — request event:**
```typescript
// packages/contracts/{initiating-domain}/src/event-schemas.ts
const orderCreatedEventSchema = z.object({
  eventType: z.literal(OrderEventTypeEnum.ORDER_CREATED),
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  occurredAt: z.string(),
});
```

**Responding domain — result events:**
```typescript
// packages/contracts/{responding-domain}/src/event-schemas.ts
const productValidationSucceededSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED),
  orderId: z.string(),
  occurredAt: z.string(),
});

const productValidationFailedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED),
  orderId: z.string(),
  reason: z.string(),
  failedProducts: z.array(z.object({
    productId: z.string(),
    issue: z.string(),
  })),
  occurredAt: z.string(),
});
```

**Rules:**
- Result events include the initiating entity's ID (`orderId`) so the resolver can look it up.
- Failure events include structured reason/details — not just a string.
- Both domains export discriminated union schemas via `z.discriminatedUnion('eventType', [...])`.

### Step 6 — Publish Request Event from Initiating Use Case

The request event is published **from the use case**, not the application service (Design Decision D2 = Option B).

```typescript
// CreateOrderUseCase
constructor(
  private readonly orderRepository: IOrderRepository,
  private readonly customerValidator: ICustomerValidator,
  private readonly eventPublisher: IEventPublisher<unknown>,
) {}

async execute(input: CreateOrderInput): Promise<Order> {
  // ... create and save order ...
  const savedOrder = await this.orderRepository.save(order);

  const orderId = savedOrder.getOrderId();
  if (orderId) {
    await this.eventPublisher.publish({
      eventType: OrderEventTypeEnum.ORDER_CREATED,
      orderId,
      customerId: input.customerId,
      items: input.items.map((i) => ({ ... })),
      occurredAt: new Date().toISOString(),
    });
  }

  return savedOrder;
}
```

**Rules:**
- The `IEventPublisher<unknown>` is injected via constructor (alongside repository and any ACL validators).
- The event publisher token (e.g. `ORDER_EVENT_PUBLISHER`) is wired in the NestJS module using `sqs-event-publisher` skill.
- The queue URL env var points to the **responding domain's inbox** (e.g. `PRODUCT_EVENTS_SQS_QUEUE_URL` → `product-events` queue).

### Step 7 — Implement Responder Handler

The responding service receives the request event, performs validation, and publishes a result event.

```typescript
// apps/{responding-domain}/{responding-service}/src/application/services/handlers/{request-event}.handler.ts
@Injectable()
export class OrderCreatedHandler implements IEventHandler<OrderCreatedPayload> {
  constructor(
    private readonly checkProductsAvailabilityUseCase: CheckProductsAvailabilityUseCase,
    @Inject('VALIDATION_RESULT_PUBLISHER')
    private readonly resultPublisher: IEventPublisher<unknown>,
  ) {}

  async handle(payload: OrderCreatedPayload, messageId?: string): Promise<void> {
    // 1. Perform domain-specific validation using own repository/use cases
    // 2. Collect failures
    // 3. Publish SUCCEEDED or FAILED result event

    if (failedProducts.length === 0) {
      await this.resultPublisher.publish({
        eventType: ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED,
        orderId: payload.orderId,
        occurredAt: new Date().toISOString(),
      });
    } else {
      await this.resultPublisher.publish({
        eventType: ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED,
        orderId: payload.orderId,
        reason: `${failedProducts.length} product(s) failed validation`,
        failedProducts,
        occurredAt: new Date().toISOString(),
      });
    }
  }
}
```

**Rules:**
- The responder imports the request event schema from `@old-st/contracts/{initiating-domain}`.
- The responder publishes result events via its own event publisher, directed at the **initiating domain's inbox** (e.g. `ORDER_EVENTS_SQS_QUEUE_URL` → `order-events` queue).
- The responder reads only from its own repository — never from the initiating domain's database.
- Infrastructure errors during validation should be treated as failure (publish `FAILED` event), not silently swallowed.

### Step 8 — Implement Resolver Handlers (Idempotent)

Create one handler per result event type in the resolving service.

```typescript
// apps/{initiating-domain}/{resolving-service}/src/application/services/handlers/
@Injectable()
export class ProductValidationSucceededHandler
  implements IEventHandler<ProductValidationSucceededPayload>
{
  constructor(
    private readonly approveProductValidationUseCase: ApproveProductValidationUseCase,
  ) {}

  async handle(payload: ProductValidationSucceededPayload): Promise<void> {
    try {
      await this.approveProductValidationUseCase.execute(payload.orderId);
    } catch (error) {
      // Idempotency: if the order is no longer in provisional state,
      // the entity throws a typed error — log and swallow
      if (
        error instanceof Error &&
        error.name === 'CannotApproveProductValidationError'
      ) {
        this.logger.warn(`Order ${payload.orderId} already resolved, skipping`);
        return;
      }
      throw error; // Rethrow unexpected errors
    }
  }
}
```

**Idempotency rules (critical):**
- Check the entity's current status before transitioning. The domain entity guard (`if status !== DRAFT`) handles this.
- Catch the specific typed domain exception by name (`error.name === 'CannotApproveProductValidationError'`).
- Log a warning and return — do not rethrow. The saga was already resolved by a previous delivery.
- Rethrow any other error — these are unexpected and should trigger SQS retry/DLQ.

### Step 9 — Wire Dispatcher Switch Cases

Update the resolving service's event handler dispatcher to route result events:

```typescript
// {resolving-service}/application/services/{domain}-event-handler.service.ts
case ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED:
  await this.productValidationSucceededHandler.handle(parsedEvent, record.messageId);
  break;

case ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED:
  await this.productValidationFailedHandler.handle(parsedEvent, record.messageId);
  break;
```

**Rule:** The dispatcher imports event type enums from `@old-st/contracts/{responding-domain}` (the domain that published the result event).

### Step 10 — Wire NestJS Module Providers

Wire all saga participants in their respective NestJS modules:

**Initiating service module (API):**
- Add `ORDER_EVENT_PUBLISHER` token pointing to responding domain's inbox queue URL.
- Inject publisher as 3rd arg to `CreateOrderUseCase` factory.

**Responding service module (event handler):**
- Add `VALIDATION_RESULT_PUBLISHER` token pointing to initiating domain's inbox queue URL.
- Wire the request event handler with use case + publisher deps.

**Resolving service module (event handler):**
- Add `ApproveProductValidationUseCase` and `FailOrderValidationUseCase` factory providers (inject repository).
- Add handler classes as plain providers.

### Step 11 — Infrastructure Wiring

1. **Queues:** Ensure both consumer-owned inbox queues exist in `scripts/setup-localstack.ts`:
   ```typescript
   { name: 'order-events', fifo: true },
   { name: 'product-events', fifo: true },
   ```

2. **Env vars:** Add queue URLs and names to `.env.local`:
   ```
   ORDER_EVENTS_SQS_QUEUE_URL=http://sqs.{REGION}.localhost.localstack.cloud:4566/000000000000/order-events.fifo
   ORDER_EVENTS_SQS_QUEUE_NAME=order-events
   PRODUCT_EVENTS_SQS_QUEUE_URL=http://sqs.{REGION}.localhost.localstack.cloud:4566/000000000000/product-events.fifo
   PRODUCT_EVENTS_SQS_QUEUE_NAME=product-events
   ```

3. **VS Code tasks:** Register any new service in `.vscode/tasks.json` and add to `Services: Start All`.

4. **Prisma migration:** If a new status was added to a Prisma-based domain, run `npx prisma migrate dev`.

### Step 12 — Tests

Follow the `write-domain-tests` skill. Minimum coverage:

- **Entity tests:** Happy-path transition, rejection when not in provisional status, terminal state blocking.
- **Use case tests:** Happy path, entity not found, entity in wrong state (via mock).
- **Initiating use case test:** Verify event is published after save (mock `IEventPublisher`).
- **Handler tests** (optional but recommended): Mock use case, verify idempotent catch logic.

---

## Key Design Decisions

| Decision | Choice in This Template | Rationale |
|---|---|---|
| D1: State flow | DRAFT → PENDING → CONFIRMED (with VALIDATION_FAILED branch) | Provisional start; saga resolves status |
| D2: Where to publish | Use case (not application service) | Keeps use case self-contained; consistent with ACL injection |
| D3: Idempotent handlers | Yes — catch typed domain exception, log + skip | SQS at-least-once delivery means duplicates are possible |

---

## Common Pitfalls

1. **Starting in final state:** Never create the entity in `PENDING` or `CONFIRMED` — always start in the provisional state and let the saga resolve.
2. **Publishing from app service:** This scatters event logic across layers. Publish from the use case alongside the save.
3. **Non-idempotent handlers:** SQS can deliver the same message twice. If the handler doesn't check current state, it may throw and enter retry loops.
4. **Cross-domain package imports:** The responder must never import from `@old-st/{initiating-domain}-domain`. Use `@old-st/contracts/{initiating-domain}` only.
5. **Responder writing to initiating domain's DB:** Each saga participant writes only to its own repository. The result event is how the response travels back.
6. **Missing error event for infrastructure failures:** If the responder's validation throws unexpectedly, it should still publish a `FAILED` event — otherwise the order stays in `DRAFT` forever.
