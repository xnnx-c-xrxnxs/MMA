---
name: dynamo-repository
description: Implement a DynamoDB OneTable repository for a domain entity. Use this when creating or modifying packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.ts. Covers the local IModel interface pattern, get() vs find() selection, mandatory GSI index param, pagination pipeline, toDomain/toPersistence, and save() branching.
---

# Implementing a DynamoDB OneTable Repository

Library docs: https://doc.onetable.io/api/model/methods/

---

## File Location

```
packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.ts
```

---

## Repository Skeleton

```typescript
import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@mma/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@mma/dynamodb-onetable';
import { I{Entity}Repository } from '../../application/interfaces/{entity}-repository.interface';
import { {Entity}Status } from '../../domain/constants';
import { {Entity} } from '../../domain/entities';
import { {Entity}DataType } from '../schemas/{Entity}Schema';

/**
 * Local structural interface for the OneTable Model instance.
 * Typed for read returns ({Entity}DataType) with flexible object inputs.
 * This avoids OneTable's complex EntityParametersForCreate mapped types.
 */
interface I{Entity}Model {
  create(properties: object): Promise<{Entity}DataType>;
  upsert(properties: object): Promise<{Entity}DataType>;
  get(properties: object, options?: object): Promise<{Entity}DataType | undefined>;
  find(properties: object, options?: object): Promise<{Entity}DataType[]>;
}

export class Dynamo{Entity}Repository implements I{Entity}Repository {
  private readonly {Entity}Model: I{Entity}Model;

  constructor(private readonly table: Table) {
    this.{Entity}Model = this.table.getModel('{Entity}') as unknown as I{Entity}Model;
  }

  // ... method implementations below
}
```

---

## CRITICAL: `get()` vs `find()` — The Most Common AI Mistake

| Situation | Correct method | Wrong method |
|---|---|---|
| Lookup by **primary key** (PK + SK) | `get()` | — |
| Lookup via **any GSI** | `find()` with `{ index: 'GSIN' }` | `get()` — will silently fail or return wrong data |
| List / paginate items | `find()` with `{ index: 'GSIN' }` | `get()` |

**`get()` ONLY works on the table's primary key (PK + SK).** Calling `get()` with GSI key attributes will produce incorrect results without throwing an error. Always use `find()` for GSI queries.

---

## CRITICAL: The GSI `index` Param Is Mandatory

Every `find()` call against a GSI **must** include `index: 'GSIN'` in the options. Omitting it makes OneTable silently fall back to the primary index, returning incorrect or empty results.

```typescript
// WRONG — falls back to primary index, returns wrong results
const results = await this.{Entity}Model.find({ email });

// CORRECT — explicitly targets GSI4
const results = await this.{Entity}Model.find(
  { email },
  { index: 'GSI4', limit: 1 }
);
```

---

## `save()` — Create vs Upsert Branch

```typescript
async save(entity: {Entity}): Promise<{Entity}> {
  const data = this.toPersistence(entity);

  if (entity.get{Entity}Id()) {
    // Entity already exists in DB — upsert to overwrite all fields
    const updated = await this.{Entity}Model.upsert(data);
    return this.toDomain(updated);
  } else {
    // New entity — create (generates ulid for the ID)
    const created = await this.{Entity}Model.create(data);
    return this.toDomain(created);
  }
}
```

**Rules:**
- Use `upsert()` for existing entities (id is set) — it writes all fields unconditionally.
- Use `create()` for new entities (id is null) — OneTable generates the ULID.
- Never call `update()` directly — it requires the item to exist and does not support the create path.

---

## Point Lookup by Primary Key

```typescript
async findById(id: string): Promise<{Entity} | null> {
  const result = await this.{Entity}Model.get({ {entity}Id: id });
  return result ? this.toDomain(result) : null;
}
```

`get()` is correct here because `{entity}Id` maps to the primary SK via the value template `'${{{entity}Id}}'` in the schema.

---

## Point Lookup via GSI (e.g. by email)

```typescript
async findByEmail(email: string): Promise<{Entity} | null> {
  const results = await this.{Entity}Model.find(
    { email },
    {
      index: 'GSI4',  // GSI4PK = '{ENTITY}#${email}'
      limit: 1,
    }
  );
  return results.length > 0 ? this.toDomain(results[0]) : null;
}
```

---

## Paginated List via GSI

This is the full required pipeline. Do not skip or reorder any step.

```typescript
async listByStatus(
  {entity}Status: {Entity}Status,
  limit = 20,
  direction = 'next',
  nextCursorPointer?: string,
  prevCursorPointer?: string,
): Promise<IPaginatedResponse<{Entity}>> {
  // Step 1: Resolve which cursor to use for this direction
  const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

  // Step 2: Build DynamoDB query options (sets limit+1, follow, next/prev/reverse)
  const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
    limit,
    'GSI5',           // ← GSI that stores {ENTITY}#{status} as hash key
    direction,
    cursorPointer || ''
  );

  // Step 3: Query DynamoDB — keep raw records (do NOT map to domain yet)
  // The cursor fields (GSI5PK, GSI5SK, PK, SK) must be present in raw records.
  // They are available because hidden: false is set on those fields in the schema.
  const results = await this.{Entity}Model.find(
    { {entity}Status },
    dynamoDbOptions
  );

  // Step 4: Run pagination logic on raw records
  // Pass the EXACT 4 GSI key names that match the schema's value templates
  const paginatedResult = pageRecordHandler<{Entity}DataType>(
    [...results],
    limit,
    direction,
    'GSI5PK',           // index partition key field name (must match schema)
    'GSI5SK',           // index sort key field name (must match schema)
    'PK',               // table partition key field name
    'SK',               // table sort key field name
    nextCursorPointer || '',
    prevCursorPointer || ''
  );

  // Step 5: Map raw records to domain entities
  return {
    data: paginatedResult.data.map((item) => this.toDomain(item)),
    nextCursorPointer: paginatedResult.nextCursorPointer,
    prevCursorPointer: paginatedResult.prevCursorPointer,
  };
}
```

---

## GSI Selection Reference

When implementing a method, look up the access pattern in the schema and use its GSI:

| Access pattern | GSI to use | Query properties | Cursor key names for `pageRecordHandler` |
|---|---|---|---|
| By email (point lookup) | GSI4 | `{ email }` | N/A — no pagination |
| List by status | GSI1 | `{ {entity}Status }` | `GSI1PK, GSI1SK, PK, SK` |
| List by role+status | GSI1 | `{ {entity}Role, {entity}Status }` | `GSI1PK, GSI1SK, PK, SK` |
| List by owner | GSI3 | `{ ownerId }` | `GSI3PK, GSI3SK, PK, SK` |

**The key names in `pageRecordHandler` must exactly match the schema field names.** Mismatching them produces null cursors on all pages.

### GSI Overloading — Check Before Adding a New GSI

Before adding a new GSI for a second entity type, always check whether an existing GSI can be reused. A GSI is entity-type-agnostic — it indexes attribute values across all items in the table. As long as the GSI hash-key values for different entity types are distinct, they can safely share a single GSI.

**Example:** A `Category` entity needs a list-by-name GSI. GSI1 already exists for `Product` list-by-status with `GSI1PK = 'PRODUCT#${status}'`. Category can write `GSI1PK = 'CATEGORY'` — a different value — and share the same index. Querying `GSI1PK = 'CATEGORY'` will only return categories.

> **Rule:** Only allocate a new GSI when no existing GSI can serve the access pattern without hash-key value collision.

---

## `toDomain()` — Private Convert DB Record to Entity

```typescript
private toDomain(raw: {Entity}DataType): {Entity} {
  // dynamodb-onetable adds createdAt/updatedAt when timestamps: true.
  // With isoDates: true (set in schema params), these come back as Date objects,
  // not strings. Always normalise them to ISO strings before reconstituting the
  // entity — otherwise Zod's z.string().datetime() will reject them and the
  // endpoint returns 500 even though the record was saved successfully.
  //
  // IMPORTANT: always type these fields as optional (Date | string | undefined).
  // Records created before timestamps were enabled, or during local table resets,
  // may lack createdAt/updatedAt entirely. If undefined, fall back to dateCreated
  // so the domain entity and Zod schema never receive undefined.
  const record = raw as {Entity}DataType & { createdAt?: Date | string; updatedAt?: Date | string };

  const toIsoString = (value: Date | string | undefined, fallback: string): string => {
    if (!value) return fallback;
    return value instanceof Date ? value.toISOString() : value;
  };

  const dateCreated = record.dateCreated ?? new Date().toISOString();

  return {Entity}.reconstitute({
    {entity}Id: record.{entity}Id,
    field1: record.field1,
    field2: record.field2,
    {entity}Status: record.{entity}Status as {Entity}Status,
    dateCreated,
    updatedAt: toIsoString(record.updatedAt, dateCreated),
  });
}
```

**Why the fallback matters:** `timestamps: true` in OneTable schema params auto-manages `createdAt`/`updatedAt` — they are never written by `toPersistence()`. For legacy records or records inserted outside of OneTable (e.g. direct DynamoDB writes during testing), these fields may be absent. Without the `undefined` guard the `toIsoString` helper would silently pass `undefined` to the entity, which then causes `ZodError: expected string received undefined` at the application service DTO mapping layer — surfacing as an unhandled 500.

---

## `toPersistence()` — Private Convert Entity to DB Record

```typescript
private toPersistence(entity: {Entity}): Partial<{Entity}DataType> {
  const id = entity.get{Entity}Id();
  return {
    ...(id && { {entity}Id: id }),  // omit id on create (OneTable generates it)
    field1: entity.getField1(),
    field2: entity.getField2(),
    {entity}Status: entity.get{Entity}Status(),
    dateCreated: entity.getDateCreated(),
    // Do NOT include createdAt / updatedAt — OneTable manages these via timestamps: true
  };
}
```

---

## `follow: true` — When to Use It

`follow: true` instructs OneTable to re-fetch the full item using the primary key after finding it via a GSI. Use it when:
- The GSI is `KEYS_ONLY` (does not project all attributes).
- The schema's index definition includes `follow: true`.

`createDynamoDbOptionWithPKSKIndex` already sets `follow: true` in its returned options object, so pagination queries automatically follow when the schema requires it.

---

## Aggregate Repositories (Multi-Model Entities)

When a repository manages an **aggregate root** (e.g. Order with OrderItem + OrderPayment), the `findById` method loads multiple models and reconstitutes them inline instead of using a single `toDomain()` helper. **The `toIsoString` timestamp guard is still mandatory on every reconstitution call that passes `updatedAt`.**

### Common Mistake — Direct Field Access Without Guard

```typescript
// WRONG — will be undefined or a Date object, causing ZodError at the DTO layer
return Order.reconstitute({
  ...
  updatedAt: (orderRecord as OrderDataType & { updatedAt: string }).updatedAt,
});
```

### Correct Pattern — toIsoString Helper Used Inline

```typescript
async findById(orderId: string): Promise<Order | null> {
  const orderRecord = await this.OrderModel.get({ orderId });
  if (!orderRecord) return null;

  // ... load child models ...

  // REQUIRED: guard createdAt/updatedAt for EVERY model in the aggregate
  const toIsoString = (value: Date | string | undefined, fallback: string): string => {
    if (!value) return fallback;
    return value instanceof Date ? value.toISOString() : value;
  };

  const oRecord = orderRecord as OrderDataType & { createdAt?: Date | string; updatedAt?: Date | string };
  const dateCreated = oRecord.dateCreated ?? new Date().toISOString();

  // Child models also need the guard
  const pRecord = paymentRecords[0] as PaymentDataType & { createdAt?: Date | string; updatedAt?: Date | string };

  return Order.reconstitute({
    ...
    updatedAt: toIsoString(oRecord.updatedAt, dateCreated),
  });
}
```

**Rule:** Anywhere a DynamoDB record’s `updatedAt` is passed to `reconstitute()`, it **must** go through `toIsoString(value, fallback)` — whether the record comes from a `get()`, `find()`, or a child model query. Casting to `{ updatedAt: string }` without the guard is always a bug. Note: `createdAt` is a OneTable persistence-only field — domain entities use `dateCreated` instead. The repository reads `record.createdAt` from OneTable and maps it to `dateCreated` in the entity.

---

## Never Use `scan()`

`Model.scan()` reads the entire table. It is never acceptable for entity lookups. Every data access must go through a GSI or the primary key.

---

## Aggregate Repository — Full Pattern

When a repository manages an aggregate root with child entities, the implementation differs significantly from a flat entity repository. All models share the same partition key (the root's ID), enabling single-partition loading.

### Constructor — Multiple Models

```typescript
export class Dynamo{Root}Repository implements I{Root}Repository {
  private readonly {Root}Model: I{Root}Model;
  private readonly {Child}Model: I{Child}Model;
  private readonly {Payment}Model: I{Payment}Model;

  constructor(private readonly table: Table) {
    this.{Root}Model = this.table.getModel('{Root}') as unknown as I{Root}Model;
    this.{Child}Model = this.table.getModel('{Child}') as unknown as I{Child}Model;
    this.{Payment}Model = this.table.getModel('{Payment}') as unknown as I{Payment}Model;
  }
}
```

Define one `I{Model}Model` interface per model, following the same structural pattern as the single-entity `I{Entity}Model`.

### Loading the Aggregate — `findById()`

Load the root record by primary key, then query children by partition key prefix:

```typescript
async findById({root}Id: string): Promise<{Root} | null> {
  // 1. Load root record
  const rootRecord = await this.{Root}Model.get({ {root}Id });
  if (!rootRecord) return null;

  // 2. Load children sharing the same partition key
  const childRecords = await this.{Child}Model.find(
    { {root}Id },
    { index: 'primary' },    // query within the same partition
  );

  const paymentRecords = await this.{Payment}Model.find(
    { {root}Id },
    { index: 'primary' },
  );

  // 3. Apply toIsoString guard to ALL models
  const toIsoString = (value: Date | string | undefined, fallback: string): string => {
    if (!value) return fallback;
    return value instanceof Date ? value.toISOString() : value;
  };

  // 4. Reconstitute children first
  const items = childRecords.map((record) => {
    const r = record as {Child}DataType & { createdAt?: Date | string; updatedAt?: Date | string };
    const dc = r.dateCreated ?? new Date().toISOString();
    return {Child}.reconstitute({
      childId: r.childId,
      // ... child fields
      dateCreated: dc,
      updatedAt: toIsoString(r.updatedAt, dc),
    });
  });

  // 5. Reconstitute root with pre-built children
  const oRecord = rootRecord as {Root}DataType & { createdAt?: Date | string; updatedAt?: Date | string };
  const dateCreated = oRecord.dateCreated ?? new Date().toISOString();

  return {Root}.reconstitute({
    {root}Id: oRecord.{root}Id,
    items,
    payment: paymentRecords.length > 0 ? /* reconstitute payment */ : null,
    dateCreated,
    updatedAt: toIsoString(oRecord.updatedAt, dateCreated),
  });
}
```

### Saving the Aggregate — Replace-Children Strategy

The simplest and most reliable approach: delete all existing children then recreate from the aggregate's current state. This avoids complex diff logic.

```typescript
async save({root}: {Root}): Promise<{Root}> {
  const {root}Id = {root}.get{Root}Id();

  if ({root}Id) {
    // ── Existing aggregate: upsert root + replace children ──────────────────
    // 1. Upsert the root record
    await this.{Root}Model.upsert(this.toRootPersistence({root}));

    // 2. Delete all existing children
    const existingItems = await this.{Child}Model.find(
      { {root}Id },
      { index: 'primary' },
    );
    for (const item of existingItems) {
      await this.table.deleteItem({ PK: item.PK, SK: item.SK });
    }

    // 3. Recreate children from current aggregate state
    for (const child of {root}.getItems()) {
      await this.{Child}Model.create(this.toChildPersistence(child, {root}Id));
    }

    // 4. Handle singular child (payment) — upsert if present
    const payment = {root}.getPayment();
    if (payment) {
      await this.{Payment}Model.upsert(this.toPaymentPersistence(payment, {root}Id));
    }

    return (await this.findById({root}Id))!;
  } else {
    // ── New aggregate: create root + children ───────────────────────────────
    const createdRoot = await this.{Root}Model.create(this.toRootPersistence({root}));
    const newId = createdRoot.{root}Id;

    for (const child of {root}.getItems()) {
      await this.{Child}Model.create(this.toChildPersistence(child, newId));
    }

    return (await this.findById(newId))!;
  }
}
```

**Trade-offs of replace-children:**
- **Pro:** Simple, correct, no stale children left behind.
- **Con:** Extra writes on every save (delete N + create N). Acceptable for small-to-medium child counts.
- **Alternative:** Diff-based approach (compare IDs, only delete removed / create new / upsert modified). Use only when write costs matter at scale.

### Deleting the Aggregate

Delete root + all children:
```typescript
async delete({root}Id: string): Promise<void> {
  // Delete all items with the same partition key
  const allRecords = await this.table.queryItems(
    { PK: `{ROOT}#${'{root}Id'}` },
    { index: 'primary' },
  );
  for (const record of allRecords) {
    await this.table.deleteItem({ PK: record.PK, SK: record.SK });
  }
}
```

### Private Conversion Methods for Aggregates

Aggregates need separate `toPersistence` methods per model type:

```typescript
private toRootPersistence({root}: {Root}): Partial<{Root}DataType> {
  const id = {root}.get{Root}Id();
  return {
    ...(id && { {root}Id: id }),
    ownerId: {root}.getOwnerId(),
    status: {root}.getStatus(),
    totalAmount: {root}.getTotalAmount(),
    dateCreated: {root}.getDateCreated(),
  };
}

private toChildPersistence(child: {Child}, {root}Id: string): Partial<{Child}DataType> {
  return {
    {root}Id,                              // back-reference to root
    productId: child.getProductId(),
    quantity: child.getQuantity(),
    price: child.getPrice(),
    dateCreated: child.getDateCreated(),
  };
}
```

---

## Advanced Query Patterns

### `begins_with` with Substitutions

For searchable GSIs where you need prefix matching (e.g. search products by name):

```typescript
async searchByName(prefix: string): Promise<{Entity}[]> {
  const results = await this.{Entity}Model.find(
    { GSI1PK: '{ENTITY}#ACTIVE' },
    {
      index: 'GSI1',
      where: '(begins_with(${GSI1SK}, @{prefix}))',
      substitutions: { prefix },
    },
  );
  return results.map((r) => this.toDomain(r));
}
```

**Rules:**
- `${GSI1SK}` is a field reference. `@{prefix}` is a value substitution.
- Use `substitutions` (not `ExpressionAttributeValues`) — OneTable handles the translation.

### Fixed-Hash GSI Query

When a GSI has a fixed hash key (value template is a literal string like `'CATEGORY'`) and you need all items, pass an empty object as the query properties:

```typescript
async listAll(): Promise<{Entity}[]> {
  const results = await this.{Entity}Model.find(
    {},                        // empty — GSI1PK is fixed by value template
    { index: 'GSI1' },
  );
  return results.map((r) => this.toDomain(r));
}
```

This works because OneTable resolves the GSI key from the value template. No runtime value is needed when the template is a constant.

---

## Barrel Export

Add to `src/infrastructure/index.ts`:
```typescript
export { Dynamo{Entity}Repository } from './repositories/dynamo-{entity}.repository';
export { {Entity}Schema } from './schemas/{Entity}Schema';
export type { {Entity}DataType } from './schemas/{Entity}Schema';
```
