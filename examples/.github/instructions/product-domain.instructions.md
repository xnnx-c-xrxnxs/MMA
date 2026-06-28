---
applyTo: "packages/product-domain/**,apps/products/**,packages/contracts/product/**"
---

# Product Domain Context

This file is automatically loaded when working on any file inside `packages/product-domain/`, `apps/products/`, or `packages/contracts/product/`. It provides the exact current state of the domain so Copilot starts with full context rather than discovering it through searches.

---

## Persistence

- **Strategy:** DynamoDB OneTable (`@old-st/dynamodb-onetable`)
- **Table env var:** `PRODUCTS_DYNAMODB_TABLE_NAME`
- **Pagination:** Cursor-based — always return `IPaginatedResponse` (never `IOffsetPaginatedResponse`)
- **Config:** `apps/products/product-api-service/src/infrastructure/config/dynamodb.config.ts`

---

## Entities

### `ProductEntity`

**File:** `packages/product-domain/src/domain/entities/product/product.entity.ts`

**Fields:**
| Field | Type | Mutable |
|---|---|---|
| `productId` | `string \| null` | No (readonly) |
| `name` | `string` | Yes |
| `description` | `string \| undefined` | Yes |
| `categoryId` | `string` | Yes |
| `price` | `number` | Yes |
| `inventory` | `number` | Yes |
| `status` | `ProductStatus` | Yes |
| `dateCreated` | `string` | No (readonly) |
| `updatedAt` | `string` | Yes |

### `ProductCategoryEntity`

**File:** `packages/product-domain/src/domain/entities/category/product-category.entity.ts`

**Fields:**
| Field | Type | Mutable |
|---|---|---|
| `categoryId` | `string \| null` | No (readonly) |
| `name` | `string` | Yes |
| `description` | `string \| undefined` | Yes |
| `status` | `CategoryStatus` | Yes |
| `dateCreated` | `string` | No (readonly) |
| `updatedAt` | `string` | Yes |

---

## Domain Constants

**Product Statuses** (`ProductStatusEnum`) — `packages/product-domain/src/domain/constants/product-statuses.ts`:
- `ACTIVE` — available for purchase
- `INACTIVE` — temporarily unavailable
- `DISCONTINUED` — permanently unavailable (cannot be re-activated)
- `DELETED` — soft-deleted (cannot be modified)

**Category Statuses** (`CategoryStatusEnum`) — `packages/product-domain/src/domain/constants/category-statuses.ts`:
- `ACTIVE` — available for product assignment
- `INACTIVE` — temporarily unavailable
- `DISCONTINUED` — permanently unavailable
- `DELETED` — soft-deleted

**Product Events** (`ProductEventTypeEnum`) — `packages/product-domain/src/domain/constants/product-events.ts`:
- `PRODUCT_DEACTIVATED`
- `PRODUCT_DISCONTINUED`
- `PRODUCT_DELETED`
- `PRODUCT_PRICE_CHANGED`
- `PRODUCT_VALIDATION_SUCCEEDED` — published after validating products in a cross-domain saga
- `PRODUCT_VALIDATION_FAILED` — published after failed product validation in a cross-domain saga

**Golden rule:** Always use `ProductStatusEnum.ACTIVE`, `CategoryStatusEnum.DISCONTINUED`, etc. — never hardcode string literals.

---

## Domain Exceptions

**Product exceptions** — `packages/product-domain/src/domain/exceptions/product/`:

| Exception | HTTP mapping | Trigger |
|---|---|---|
| `CannotActivateNonInactiveProductError` | 409 | Activate called on non-INACTIVE product |
| `CannotDeactivateNonActiveProductError` | 409 | Deactivate called on non-ACTIVE product |
| `CannotDiscontinueProductError` | 409 | Discontinue called when not ACTIVE/INACTIVE |
| `CannotUpdateDeletedProductError` | 409 | Update on DELETED product |
| `CannotUpdateDiscontinuedProductError` | 409 | Update on DISCONTINUED product |
| `ProductAlreadyDeletedError` | 409 | Delete called on already-DELETED product |
| `InvalidProductPriceError` | 409 | Price ≤ 0 or invalid |
| `InvalidProductNameError` | 409 | Name fails validation |
| `InvalidProductInventoryError` | 409 | Inventory < 0 |

**Category exceptions** — `packages/product-domain/src/domain/exceptions/category/`:

| Exception | HTTP mapping | Trigger |
|---|---|---|
| `CannotActivateNonInactiveCategoryError` | 409 | Activate on non-INACTIVE category |
| `CannotDeactivateNonActiveCategoryError` | 409 | Deactivate on non-ACTIVE category |
| `CannotDiscontinueCategoryError` | 409 | Discontinue when not ACTIVE/INACTIVE |
| `CannotUpdateDeletedCategoryError` | 409 | Update on DELETED category |
| `CategoryAlreadyDeletedError` | 409 | Delete on already-DELETED category |
| `InvalidCategoryNameError` | 409 | Name fails validation |

---

## DynamoDB GSI Access Patterns

**Schema:** `packages/product-domain/src/infrastructure/schemas/ProductSchema.ts`

**Products:**
| GSI | PK pattern | SK pattern | Use case |
|---|---|---|---|
| GSI1 | `PRODUCT#${status}` | `${name}` | List products by status (sorted by name) |
| GSI2 | `PRODUCT#CATEGORY#${categoryId}` | `${name}` | List products by category |
| GSI4 | `PRODUCT` | `${name}` | Name prefix search (all products sorted by name) |

**Categories (GSI1 overloaded):**
| GSI | PK pattern | SK pattern | Use case |
|---|---|---|---|
| GSI1 | `CATEGORY` | `${name}` | List all categories sorted by name |

**Rules when adding a new query pattern:** If none of the above GSIs support it, add a new GSI to `ProductSchema.ts` and update `scripts/setup-localstack.ts`, then run `pnpm run localstack:setup:force`.

---

## Use Cases

**Location:** `packages/product-domain/src/application/use-cases/`

**Product use cases** (`product/` subfolder):

| Use case | Operation |
|---|---|
| `CreateProductUseCase` | Create new product |
| `GetProductByIdUseCase` | Get by productId |
| `ListProductsByStatusUseCase` | Cursor-paginated list by status (GSI1) |
| `ListProductsByCategoryUseCase` | Cursor-paginated list by categoryId (GSI2) |
| `SearchProductsByNameUseCase` | Name prefix search (GSI4) |
| `UpdateProductDetailsUseCase` | Update name, description, categoryId |
| `UpdateProductPriceUseCase` | Update price (publishes PRODUCT_PRICE_CHANGED) |
| `UpdateProductInventoryUseCase` | Update inventory count |
| `ActivateProductUseCase` | INACTIVE → ACTIVE |
| `DeactivateProductUseCase` | ACTIVE → INACTIVE (publishes PRODUCT_DEACTIVATED) |
| `DiscontinueProductUseCase` | → DISCONTINUED (publishes PRODUCT_DISCONTINUED) |
| `DeleteProductUseCase` | Soft-delete → DELETED (publishes PRODUCT_DELETED) |
| `CheckProductsAvailabilityUseCase` | Bulk availability check (used in cross-domain saga) |

**Category use cases** (`category/` subfolder): create, get, list, update, activate, deactivate, discontinue, delete.

---

## Services & Apps

| App | Port | Description |
|---|---|---|
| `product-api-service` | `3001` (`PRODUCT_SERVICE_PORT`) | HTTP REST API |
| `product-event-handler-service` | — (no HTTP) | SQS consumer for cross-domain events |

**SQS queues:**
- `PRODUCT_EVENTS_SQS_QUEUE_URL` / `PRODUCT_EVENTS_SQS_QUEUE_NAME=product-events` (FIFO — resolves to `product-events.fifo`) — outbound events published by product-api-service
- `ORDER_EVENTS_SQS_QUEUE_URL` — inbound cross-domain events consumed by product-event-handler-service

**Application service:** `apps/products/product-api-service/src/application/services/product-application.service.ts`

---

## Cross-Domain Interactions

### Choreography Saga (Product ↔ Order)

This domain participates in a cross-domain choreography saga for order validation:

1. `order-api-service` publishes `ORDER_CREATED` to `product-events` queue
2. `product-event-handler-service` receives it → calls `CheckProductsAvailabilityUseCase`
3. Result published as `PRODUCT_VALIDATION_SUCCEEDED` or `PRODUCT_VALIDATION_FAILED` to `order-events` queue
4. `order-event-handler-service` resolves order state

**Key rule:** `product-event-handler-service` only writes to the product domain's repository — never the order domain's. It publishes a result event back to the order domain.

### Product Price Changes → Order Updates

`PRODUCT_PRICE_CHANGED` is consumed by `order-event-handler-service` to update item prices in DRAFT orders.

---

## Contracts

**Import path:** `@old-st/contracts/product` — never bare `@old-st/contracts`

**Files:**
- `packages/contracts/product/src/schemas.ts` — Zod input/response schemas
- (event schemas are defined in domain constants and used directly)

---

## Skills to Use

| Task | Skill |
|---|---|
| Add a new status transition or business rule | `domain-business-rules` |
| Add a new use case | `new-use-case` |
| Update Zod schemas / contracts | `add-contracts` |
| Add a new REST endpoint | `add-api-endpoints` |
| Update the DynamoDB repository | `dynamo-repository` |
| Add a new GSI or query pattern | `new-dynamo-schema` |
| Update `DomainExceptionFilter` | `domain-exception-filter` |
| Add SQS event publishing to product-api-service | `sqs-event-publisher` |
| Extend the cross-domain saga handling | `choreography-saga` |
| Write tests | `write-domain-tests` |
| Add a full feature end-to-end | `add-feature-existing-domain` |
