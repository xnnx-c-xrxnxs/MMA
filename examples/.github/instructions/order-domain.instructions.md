---
applyTo: "packages/order-domain/**,apps/orders/**,packages/contracts/order/**"
---

# Order Domain Context

This file is automatically loaded when working on any file inside `packages/order-domain/`, `apps/orders/`, or `packages/contracts/order/`. It provides the exact current state of the domain so Copilot starts with full context rather than discovering it through searches.

---

## Persistence

- **Strategy:** Prisma + PostgreSQL
- **Database URL env var:** `ORDERS_DATABASE_URL`
- **Pagination:** Offset-based — always return `IOffsetPaginatedResponse` (never `IPaginatedResponse`)
- **Config:** `apps/orders/order-api-service/src/infrastructure/config/prisma.config.ts`
- **Schema:** `packages/order-domain/src/infrastructure/prisma/schema.prisma`
- **Generated client:** `packages/order-domain/src/infrastructure/generated/client/` (gitignored — run `npx prisma generate` to regenerate)
- **Local database:** `postgresql://dev:dev@localhost:5432/orders_db`

**Migration workflow (local only):**
```bash
cd packages/order-domain
npx prisma migrate dev --name describe_change   # creates + applies migration
npx prisma generate                              # regenerates client after schema changes
```

**Deployed migrations:** Run automatically by the ECS init-runner during CD (`deployTasks` entry in `service-registry.json`). Never run `prisma migrate deploy` from CI against a VPC-private RDS instance.

---

## Entities

### `OrderEntity` (aggregate root)

**File:** `packages/order-domain/src/domain/entities/order.entity.ts`

**Fields:**
| Field | Type | Mutable |
|---|---|---|
| `orderId` | `string \| null` | No (readonly) |
| `customerId` | `string` | Yes |
| `items` | `OrderItem[]` | Yes (via methods) |
| `payment` | `OrderPayment \| null` | Yes (via methods) |
| `orderStatus` | `OrderStatus` | Yes (via transitions) |
| `totalAmount` | `number` | Yes (auto-recalculated) |
| `dateCreated` | `string` | No (readonly) |
| `updatedAt` | `string` | Yes |

The `totalAmount` is automatically recalculated whenever items change — never set it directly.

### `OrderItem`

**File:** `packages/order-domain/src/domain/entities/order-item.entity.ts`

Fields: `itemId`, `productId`, `productName`, `quantity`, `unitPrice`, `totalPrice`, `dateCreated`, `updatedAt`

### `OrderPayment`

**File:** `packages/order-domain/src/domain/entities/order-payment.entity.ts`

Fields: `paymentId`, `paymentMethod`, `amount`, `paymentStatus`, `transactionId`, `dateCreated`, `updatedAt`

---

## Domain Constants

**Order Statuses** (`OrderStatusEnum`) — `packages/order-domain/src/domain/constants/order-statuses.ts`:
- `DRAFT` — freshly created, items can be added/removed
- `PENDING` — submitted for product validation (saga in progress)
- `CONFIRMED` — validation passed, payment authorized
- `PROCESSING` — payment captured, fulfillment started
- `SHIPPED` — dispatched
- `DELIVERED` — delivery confirmed
- `CANCELLED` — cancelled (from DRAFT, PENDING, or CONFIRMED)
- `REFUNDED` — refund processed
- `VALIDATION_FAILED` — product validation saga failed

**Payment Statuses** (`PaymentStatusEnum`) — `packages/order-domain/src/domain/constants/payment-statuses.ts`:
- `PENDING` → `AUTHORIZED` → `CAPTURED` → `REFUNDED`
- `PENDING` → `FAILED`
- `AUTHORIZED` → `CANCELLED`

**Payment Methods** (`PaymentMethodEnum`) — `packages/order-domain/src/domain/constants/payment-methods.ts`:
- `CREDIT_CARD`, `DEBIT_CARD`, `PAYPAL`, `BANK_TRANSFER`, `CASH_ON_DELIVERY`

**Order Events** (`OrderEventTypeEnum`) — `packages/order-domain/src/domain/constants/order-event-types.ts`:
- `ORDER_CREATED` — published by `CreateOrderUseCase` to trigger product validation saga

**Golden rule:** Always use `OrderStatusEnum.DRAFT`, `PaymentStatusEnum.AUTHORIZED`, `PaymentMethodEnum.CREDIT_CARD`, etc. — never hardcode string literals.

---

## Domain Exceptions

All in `packages/order-domain/src/domain/exceptions/`:

| Exception | HTTP mapping | Trigger |
|---|---|---|
| `CannotModifyNonDraftOrderError` | 409 | Add/remove items on non-DRAFT order |
| `CannotCancelOrderError` | 409 | Cancel from invalid status |
| `CannotConfirmEmptyOrderError` | 409 | Confirm with no items |
| `CannotApproveProductValidationError` | 409 | Approve validation from wrong status |
| `CannotFailValidationError` | 409 | Fail validation from wrong status |
| `CannotRefundOrderError` | 409 | Refund from invalid status |
| `InvalidOrderStatusTransitionError` | 409 | Any invalid status transition |
| `InvalidPaymentStatusTransitionError` | 409 | Any invalid payment status transition |
| `InvalidPaymentStateForConfirmationError` | 409 | Confirm without AUTHORIZED payment |
| `PaymentRequiredForConfirmationError` | 409 | Confirm with no payment |
| `OrderAlreadyHasPaymentError` | 409 | Add payment when one already exists |
| `PaymentAmountMismatchError` | 409 | Payment amount ≠ order total |
| `OrderItemNotFoundError` | 404 | Item not found on order |
| `InvalidQuantityError` | 409 | Quantity ≤ 0 |
| `InvalidPriceError` | 409 | Price ≤ 0 |
| `InvalidPaymentAmountError` | 409 | Payment amount ≤ 0 |
| `CustomerIdRequiredError` | 409 | Missing customerId on create |
| `PriceDriftDetectedError` | 409 | Item price changed between draft and confirm |
| `ProductNameRequiredError` | 409 | Missing productName on item |

---

## Prisma Schema Models

**File:** `packages/order-domain/src/infrastructure/prisma/schema.prisma`

| Model | Table | Relationships |
|---|---|---|
| `Order` | `orders` | Has many `OrderItem`, has one `OrderPayment`. Indexes: `customerId`, `orderStatus` |
| `OrderItem` | `order_items` | Belongs to `Order` (cascade delete). Index: `productId` |
| `OrderPayment` | `order_payments` | Belongs to `Order` (cascade delete) |

**Cascade delete:** Deleting an `Order` automatically deletes its `OrderItem` and `OrderPayment` records. The repository only calls `delete()` on the root `Order` — never on child models directly.

---

## Use Cases

**Location:** `packages/order-domain/src/application/use-cases/`

| Use case | Operation |
|---|---|
| `CreateOrderUseCase` | Create DRAFT order + publish ORDER_CREATED event |
| `GetOrderByIdUseCase` | Get by orderId with items + payment |
| `ListOrdersByCustomerUseCase` | Offset-paginated list by customerId |
| `ListOrdersByStatusUseCase` | Offset-paginated list by status |
| `AddOrderItemUseCase` | Add item to DRAFT order (recalculates total) |
| `RemoveOrderItemUseCase` | Remove item from DRAFT order |
| `UpdateOrderItemQuantityUseCase` | Update item quantity (DRAFT only) |
| `AddOrderPaymentUseCase` | Attach payment to DRAFT order |
| `ConfirmOrderUseCase` | PENDING → CONFIRMED (requires AUTHORIZED payment) |
| `ApproveProductValidationUseCase` | PENDING → CONFIRMED (saga success path) |
| `FailOrderValidationUseCase` | PENDING → VALIDATION_FAILED (saga failure path) |
| `StartProcessingOrderUseCase` | CONFIRMED → PROCESSING (capture payment) |
| `AuthorizePaymentUseCase` | Payment PENDING → AUTHORIZED |
| `CapturePaymentUseCase` | Payment AUTHORIZED → CAPTURED |
| `ShipOrderUseCase` | PROCESSING → SHIPPED |
| `DeliverOrderUseCase` | SHIPPED → DELIVERED |
| `CancelOrderUseCase` | DRAFT/PENDING/CONFIRMED → CANCELLED |
| `RefundOrderUseCase` | DELIVERED → REFUNDED |
| `DeleteOrderUseCase` | Hard delete (cascades via Prisma) |
| `UpdateItemLatestPriceUseCase` | Update item unit price (reacts to PRODUCT_PRICE_CHANGED) |
| `CancelDraftOrdersByProductUseCase` | Cancel all DRAFT orders containing a discontinued product |

**Important:** `ApproveProductValidationUseCase` and `FailOrderValidationUseCase` are **idempotent** — they check the current order status before transitioning and silently skip (log + return) if the order has already been resolved. This prevents double-processing in the saga.

---

## Services & Apps

| App | Port | Description |
|---|---|---|
| `order-api-service` | `3002` (`ORDER_SERVICE_PORT`) | HTTP REST API (requires VPC in deployed) |
| `order-event-handler-service` | — (no HTTP) | SQS consumer for cross-domain events |

**SQS queues:**
- `ORDER_EVENTS_SQS_QUEUE_URL` / `ORDER_EVENTS_SQS_QUEUE_NAME=order-events` (FIFO — resolves to `order-events.fifo`) — inbound events consumed by `order-event-handler-service`
- `PRODUCT_EVENTS_SQS_QUEUE_URL` — outbound: `ORDER_CREATED` published by `order-api-service` to the product domain's queue

**Lambda:** Requires VPC (`requiresVpc: true` in `service-registry.json`) to reach RDS PostgreSQL.

**Secrets:** `AWS_SECRETS_ARN` injected by Terraform. `SecretsConfig.resolve(['ORDERS_DATABASE_URL'])` called in `main.ts` Lambda handler before NestJS bootstraps.

**Application service:** `apps/orders/order-api-service/src/application/services/order-application.service.ts`

---

## Cross-Domain Interactions

### Orders → Users (ACL)

`order-api-service` validates that the customer (`customerId`) exists and is ACTIVE before creating an order.
- **Port (interface):** `packages/order-domain/src/application/interfaces/user-validator.interface.ts`
- **Adapter:** `apps/orders/order-api-service/src/infrastructure/clients/user-api.client.ts`
- **Env var:** `API_USER_URL`

### Orders → Products (ACL)

`order-api-service` validates product existence during item addition.
- **Port (interface):** `packages/order-domain/src/application/interfaces/product-validator.interface.ts`
- **Adapter:** `apps/orders/order-api-service/src/infrastructure/clients/product-api.client.ts`
- **Env var:** `API_PRODUCT_URL`

### Choreography Saga (Order ↔ Product)

1. `CreateOrderUseCase` publishes `ORDER_CREATED` to `PRODUCT_EVENTS_SQS_QUEUE_URL`
2. `product-event-handler-service` validates → publishes result to `ORDER_EVENTS_SQS_QUEUE_URL`
3. `order-event-handler-service` calls `ApproveProductValidationUseCase` or `FailOrderValidationUseCase`

---

## Contracts

**Import path:** `@old-st/contracts/order` — never bare `@old-st/contracts`

**Files:**
- `packages/contracts/order/src/schemas.ts` — Zod input/response schemas (offset pagination)
- `packages/contracts/order/src/event-schemas.ts` — SQS event Zod schemas

---

## Skills to Use

| Task | Skill |
|---|---|
| Add a new status transition or business rule | `domain-business-rules` |
| Add a new use case | `new-use-case` |
| Update Zod schemas / contracts | `add-contracts` |
| Add a new REST endpoint | `add-api-endpoints` |
| Update the Prisma repository | `prisma-repository` |
| Change the Prisma schema | `new-prisma-schema` |
| Wire Prisma in a NestJS module | `prisma-service-wiring` |
| Update `DomainExceptionFilter` | `domain-exception-filter` |
| Add or modify ACL cross-service calls | `sync-cross-service-call` |
| Extend the choreography saga | `choreography-saga` |
| Add a Prisma migration as a deploy task | `init-runner-deploy-task` |
| Write tests | `write-domain-tests` |
| Add a full feature end-to-end | `add-feature-existing-domain` |
