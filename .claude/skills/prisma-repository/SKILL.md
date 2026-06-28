---
name: prisma-repository
description: Implement a Prisma + PostgreSQL repository for a domain entity. Use this when creating or modifying packages/{domain}-domain/src/infrastructure/repositories/prisma-{entity}.repository.ts. Covers PrismaClient injection, toDomain()/toPersistence(), save() with $transaction, offset pagination via skip/take + count(), findUnique vs findMany, cascade delete, and aggregate repository pattern (nested includes).
---

# Implementing a Prisma Repository

Official docs: https://www.prisma.io/docs/orm/prisma-client

---

## File Location

```
packages/{domain}-domain/src/infrastructure/repositories/prisma-{entity}.repository.ts
```

---

## Repository Skeleton

```typescript
import { PrismaClient, {Entity} as Prisma{Entity} } from '../generated/client';
import { IOffsetPaginatedResponse, createOffsetPaginatedResponse } from '@mma/common';
import { I{Entity}Repository } from '../../application/interfaces/{entity}-repository.interface';
import { {Entity} } from '../../domain/entities/{entity}.entity';
import { {Entity}Status } from '../../domain/constants';

export class Prisma{Entity}Repository implements I{Entity}Repository {
  constructor(private readonly prisma: PrismaClient) {}

  // ... method implementations below
}
```

**Rules:**
- Import `PrismaClient` and Prisma model types from the generated client (`../generated/client`).
- Import `IOffsetPaginatedResponse` and `createOffsetPaginatedResponse` from `@mma/common`.
- The constructor takes a `PrismaClient` — never create it internally.
- Never import `@prisma/client` directly in the repository. Always import from the domain's generated client path.

---

## CRITICAL: `findUnique()` vs `findMany()` — When to Use Each

| Situation | Correct method |
|---|---|
| Lookup by **primary key** (`@id`) or **unique field** (`@unique`) | `findUnique()` |
| Lookup by any non-unique field or relationship filter | `findMany()` |
| List / paginate items | `findMany()` with `skip`/`take` |

**`findUnique()` only works on `@id` and `@unique` fields.** Using it on a non-unique field will produce a TypeScript error.

---

## `save()` — Create vs Update with `$transaction`

```typescript
async save(entity: {Entity}): Promise<{Entity}> {
  const entityId = entity.get{Entity}Id();

  if (entityId) {
    // ── Existing entity: update in a transaction ──
    await this.prisma.$transaction(async (tx) => {
      await tx.{entity}.update({
        where: { {entity}Id: entityId },
        data: {
          field1: entity.getField1(),
          field2: entity.getField2(),
          {entity}Status: entity.get{Entity}Status(),
        },
      });
    });

    return this.findById(entityId) as Promise<{Entity}>;
  }

  // ── New entity: create in a transaction ──
  const created = await this.prisma.$transaction(async (tx) => {
    return tx.{entity}.create({
      data: {
        field1: entity.getField1(),
        field2: entity.getField2(),
        {entity}Status: entity.get{Entity}Status(),
      },
    });
  });

  return this.findById(created.{entity}Id) as Promise<{Entity}>;
}
```

**Rules:**
- Use `$transaction()` for atomic multi-model writes (especially aggregates with child entities).
- For simple single-model updates, a transaction is optional but recommended for consistency.
- Use `update()` for existing entities (id is set). Prisma raises `RecordNotFoundError` if the record is missing.
- Use `create()` for new entities. Prisma auto-generates the UUID via `@default(uuid())`.
- After saving, re-read via `findById()` to return the fully hydrated domain entity (with `include` relations if applicable).

---

## Point Lookup by Primary Key

```typescript
async findById({entity}Id: string): Promise<{Entity} | null> {
  const record = await this.prisma.{entity}.findUnique({
    where: { {entity}Id },
  });

  return record ? this.toDomain(record) : null;
}
```

`findUnique()` is correct here because `{entity}Id` is the `@id` field in the Prisma schema.

---

## Point Lookup by Unique Field

```typescript
async findByEmail(email: string): Promise<{Entity} | null> {
  const record = await this.prisma.{entity}.findUnique({
    where: { email },
  });

  return record ? this.toDomain(record) : null;
}
```

Only use `findUnique()` when the field has `@unique` in the Prisma schema.

---

## Paginated List — Offset Pattern

This is the full required pipeline. Do not skip or reorder any step.

```typescript
async listByStatus(
  {entity}Status: {Entity}Status,
  page = 1,
  limit = 20,
): Promise<IOffsetPaginatedResponse<{Entity}>> {
  const where = { {entity}Status };

  // Step 1: Run data query and count query in parallel
  const [records, total] = await Promise.all([
    this.prisma.{entity}.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { dateCreated: 'desc' },
    }),
    this.prisma.{entity}.count({ where }),
  ]);

  // Step 2: Map raw Prisma records to domain entities
  const entities = records.map((r) => this.toDomain(r));

  // Step 3: Return standardized paginated response
  return createOffsetPaginatedResponse(entities, total, page, limit);
}
```

**Rules:**
- Always run `findMany()` and `count()` in parallel via `Promise.all()` for efficiency.
- Use the same `where` clause for both queries to ensure count matches data.
- `skip = (page - 1) * limit` converts 1-based page to 0-based offset.
- `take = limit` controls page size.
- Always provide `orderBy` for deterministic ordering (typically `dateCreated: 'desc'`).
- Use `createOffsetPaginatedResponse()` from `@mma/common` — it calculates `totalPages` automatically.

---

## `toDomain()` — Private Convert Prisma Record to Entity

```typescript
private toDomain(record: Prisma{Entity}): {Entity} {
  return {Entity}.reconstitute({
    {entity}Id: record.{entity}Id,
    field1: record.field1,
    field2: record.field2,
    {entity}Status: record.{entity}Status,
    dateCreated: record.dateCreated.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
```

**Why `.toISOString()`:** Prisma returns `DateTime` fields as JavaScript `Date` objects. Domain entities expect ISO string timestamps. Always convert via `.toISOString()`.

**Key difference from DynamoDB:** No fallback guards needed. Prisma enforces `@default(now())` and `@updatedAt` at the database level — `dateCreated` and `updatedAt` are never `null` or `undefined` on read.

---

## Relation Filtering (Cross-Entity Queries)

When querying the root entity by a child entity's field (e.g. find orders that contain a specific product):

```typescript
async findByProductId(
  productId: string,
  page = 1,
  limit = 50,
): Promise<IOffsetPaginatedResponse<{Root}>> {
  const where = { items: { some: { productId } } };

  const [records, total] = await Promise.all([
    this.prisma.{root}.findMany({
      where,
      include: { items: true, payment: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { dateCreated: 'desc' },
    }),
    this.prisma.{root}.count({ where }),
  ]);

  const entities = records.map((r) => this.toDomain(r, r.items, r.payment));

  return createOffsetPaginatedResponse(entities, total, page, limit);
}
```

**Key:** Use `{ some: { field: value } }` for relation-based filtering. Prisma translates this to an efficient `EXISTS` subquery.

---

## Cascade Delete

```typescript
async delete({entity}Id: string): Promise<void> {
  await this.prisma.{entity}.delete({
    where: { {entity}Id },
  });
}
```

When the Prisma schema defines `onDelete: Cascade` on child relations, deleting the parent automatically removes all children. No manual child deletion needed.

---

## Aggregate Repository — Full Pattern

When a repository manages an aggregate root with child entities (e.g. Order + OrderItem + OrderPayment), the implementation uses Prisma's `include` for loading and `$transaction` for atomic writes.

### Loading the Aggregate — `findById()` with `include`

```typescript
async findById({root}Id: string): Promise<{Root} | null> {
  const record = await this.prisma.{root}.findUnique({
    where: { {root}Id },
    include: { items: true, payment: true },
  });

  if (!record) return null;

  return this.toDomain(record, record.items, record.payment);
}
```

The `include` option eagerly loads related models in a single query. This replaces DynamoDB's multi-model partition query pattern.

### Saving the Aggregate — Replace-Children Strategy in `$transaction`

```typescript
async save({root}: {Root}): Promise<{Root}> {
  const {root}Id = {root}.get{Root}Id();

  if ({root}Id) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Update root
      await tx.{root}.update({
        where: { {root}Id },
        data: {
          field1: {root}.getField1(),
          {root}Status: {root}.get{Root}Status(),
        },
      });

      // 2. Delete all existing children and recreate
      await tx.{child}.deleteMany({ where: { {root}Id } });
      await tx.{payment}.deleteMany({ where: { {root}Id } });

      // 3. Create children from current aggregate state
      const items = {root}.getItems();
      if (items.length > 0) {
        await tx.{child}.createMany({
          data: items.map((item) => ({
            {root}Id,
            productId: item.getProductId(),
            quantity: item.getQuantity(),
            price: item.getPrice(),
          })),
        });
      }

      // 4. Create singular child if present
      const payment = {root}.getPayment();
      if (payment) {
        await tx.{payment}.create({
          data: {
            {root}Id,
            amount: payment.getAmount(),
            paymentStatus: payment.getPaymentStatus(),
          },
        });
      }
    });

    return this.findById({root}Id) as Promise<{Root}>;
  }

  // New aggregate
  const created = await this.prisma.$transaction(async (tx) => {
    const newRoot = await tx.{root}.create({
      data: {
        field1: {root}.getField1(),
        {root}Status: {root}.get{Root}Status(),
      },
    });

    // ... create children with newRoot.{root}Id ...

    return newRoot;
  });

  return this.findById(created.{root}Id) as Promise<{Root}>;
}
```

**Trade-offs of replace-children (same as DynamoDB aggregate pattern):**
- **Pro:** Simple, correct, no stale children left behind.
- **Con:** Extra writes on every save. Prisma's `deleteMany` + `createMany` are efficient for small/medium child counts.
- **Alternative:** Diff-based approach when write costs matter at scale.

### `toDomain()` for Aggregates

```typescript
private toDomain(
  record: Prisma{Root},
  items: Prisma{Child}[],
  payment: Prisma{Payment} | null,
): {Root} {
  const domainItems = items.map((item) =>
    {Child}.reconstitute({
      childId: item.childId,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      dateCreated: item.dateCreated.toISOString(),
    }),
  );

  const domainPayment = payment
    ? {Payment}.reconstitute({
        paymentId: payment.paymentId,
        amount: payment.amount,
        paymentStatus: payment.paymentStatus,
        dateCreated: payment.dateCreated.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      })
    : null;

  return {Root}.reconstitute({
    {root}Id: record.{root}Id,
    items: domainItems,
    payment: domainPayment,
    {root}Status: record.{root}Status,
    dateCreated: record.dateCreated.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
```

---

## Key Differences from DynamoDB Repository

| Aspect | DynamoDB (OneTable) | Prisma (PostgreSQL) |
|---|---|---|
| Pagination style | Cursor-based (`IPaginatedResponse`) | Offset-based (`IOffsetPaginatedResponse`) |
| ID generation | ULID via `generate: 'ulid'` | UUID via `@default(uuid())` |
| Timestamp handling | `toIsoString()` guard + fallback needed (records may lack timestamps) | `.toISOString()` — no guard needed (DB enforces defaults) |
| Aggregate loading | Multi-model partition query (`find()` per model) | Single query with `include` |
| Aggregate save | Manual delete + recreate per model | `$transaction` with `deleteMany` + `createMany` |
| Total count | Not available (DynamoDB has no count) | `prisma.{model}.count()` in parallel |
| GSI/index management | Schema-level GSI definitions + LocalStack setup | `@@index` annotations + `prisma migrate` |
| Delete | Manual cascade (delete all partition items) | Automatic via `onDelete: Cascade` |
| Import source | `'dynamodb-onetable'` + `@mma/dynamodb-onetable` | `'../generated/client'` |

---

## Never Use `findMany()` Without Pagination

`findMany()` without `take` will return all matching records. Always provide `skip` and `take` for list endpoints. For internal batch operations (e.g. event handlers that process all matching records), use explicit page-based loops:

```typescript
let currentPage = 1;
let hasMore = true;

while (hasMore) {
  const result = await repository.findByProductId(productId, currentPage, 50);

  for (const entity of result.data) {
    // process entity
  }

  hasMore = currentPage < result.totalPages;
  currentPage++;
}
```

---

## Barrel Export

Add to `src/infrastructure/repositories/index.ts`:
```typescript
export { Prisma{Entity}Repository } from './prisma-{entity}.repository';
```

Add to `src/infrastructure/index.ts`:
```typescript
export * from './repositories';
export { PrismaClient } from './generated/client';
```
