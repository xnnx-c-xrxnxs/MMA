---
name: new-dynamo-schema
description: Create a DynamoDB OneTable schema for a new domain entity. Use this when adding a schema file to packages/{domain}-domain/src/infrastructure/schemas/. Covers GSI naming conventions, value template syntax, primary key design, and access pattern mapping.
---

# Creating a DynamoDB OneTable Schema

Official docs: https://doc.onetable.io/api/table/schemas/indexes/

---

## Required Information — Ask Before Starting

Before generating the schema, confirm all access patterns with the developer:

1. How will the entity be looked up by a single item? (usually by entity ID — primary key)
2. How will lists be fetched? (e.g. by status, by owner+status, by type)
3. Will any field need a unique point lookup? (e.g. lookup by email, by slug, by external ID)

Each access pattern maps to a GSI. Define only GSIs that are needed for confirmed access patterns.

---

## File Location

```
packages/{domain}-domain/src/infrastructure/schemas/{Entity}Schema.ts
```

---

## Schema Template

```typescript
import { Entity } from 'dynamodb-onetable';
import { {ENTITY}_STATUSES, {ENTITY}_ROLES } from '../../domain/constants';

export const {Entity}Schema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' },   // add only indexes you need
    GSI2: { hash: 'GSI2PK' },                    // hash-only index for point lookups
    // ... add GSIs based on confirmed access patterns
  },
  models: {
    {Entity}: {
      PK:  { type: String, value: '{ENTITY}', hidden: false },
      SK:  { type: String, value: '${{{entity}Id}}', hidden: false },

      {entity}Id: { type: String, generate: 'ulid' },  // auto-generated primary ID

      // ── Required fields ──
      field1:  { type: String, required: true },
      field2:  { type: String, required: true },

      // ── Status / Role fields (use domain constant arrays for enum validation) ──
      {entity}Status: { type: String, enum: {ENTITY}_STATUSES, required: true },

      // ── GSI key fields — value templates derived from entity attributes ──
      GSI1PK: { type: String, value: '{ENTITY}#${{{entity}Status}}',   hidden: false },
      GSI1SK: { type: String, value: '${{{entity}Id}}',                hidden: false },

      GSI2PK: { type: String, value: '{ENTITY}#${email}',             hidden: false },

      // ── Timestamps ──
      dateCreated: { type: String },
    },
  } as const,
  params: {
    isoDates: true,   // createdAt and updatedAt are stored as ISO strings
    timestamps: true, // OneTable auto-manages createdAt and updatedAt
  },
};

export type {Entity}DataType = Entity<typeof {Entity}Schema.models.{Entity}>;
```

---

## GSI Design Decision Table

Map each confirmed access pattern to a GSI:

| Access Pattern | index | Hash Key (PK) value template | Sort Key (SK) value template |
|---|---|---|---|
| Lookup by entity ID (primary) | primary | `{ENTITY}` | `${entityId}` |
| Point lookup by email | GSI2 | `{ENTITY}#${email}` | (none — hash-only) |
| List by status | GSI3 | `{ENTITY}#${status}` | `${email}` or `${entityId}` |
| List by role+status | GSI1 | `{ENTITY}#${role}#${status}` | `${email}` or `${entityId}` |
| List by owner | GSI4 | `{ENTITY}#${ownerId}` | `${createdAt}` |

Rules:
- Hash-only GSIs (no sort key) are used for point lookups. Never paginate over them.
- GSIs with a sort key support cursor-based pagination via the `dynamo-repository` skill.
- The GSI hash key must have high cardinality — avoid using a static value as the hash key for a paginated GSI.

---

## GSI Overloading (Single Table Design — Must Follow)

A GSI is just a hash-range index over attribute values. It has no knowledge of entity types. Multiple models in the same schema **must share GSIs** whenever their GSI hash-key values are distinct — this is the canonical single-table design pattern known as **GSI overloading**.

### Why it matters
- DynamoDB's limit is 20 GSIs per table (historically 5). Every unnecessary GSI wastes this budget.
- **Write amplification**: every item write propagates to every GSI the item participates in. Unused or duplicated GSIs magnify write costs with zero benefit.
- **Storage cost**: each GSI stores a full projection of the indexed attributes.

### How to apply it

If a second entity needs a list-by-name index and you already have GSI1 for another entity's list-by-status, ask: _do their GSI1PK values collide?_

| Entity | GSI1PK value | Collision? |
|---|---|---|
| Product (by status) | `'PRODUCT#ACTIVE'`, `'PRODUCT#INACTIVE'` ... | — |
| Category (by name) | `'CATEGORY'` | **No** — different partition value |

Since `'CATEGORY'` ≠ `'PRODUCT#ACTIVE'`, both entities can write to GSI1 and a query for `GSI1PK = 'CATEGORY'` will return _only_ categories. No dedicated GSI5 is needed.

### Rule of thumb

> **Add a new GSI only when no existing GSI can serve the access pattern with a distinct, non-colliding hash-key value.**

### Wrong — needless extra GSI
```typescript
// Category adds GSI5 for list-by-name — wasteful, GSI1 is already available
GSI5PK: { type: String, value: 'CATEGORY', hidden: false },
GSI5SK: { type: String, value: '${name}', hidden: false },
```

### Correct — overload GSI1
```typescript
// Category shares GSI1 — PK 'CATEGORY' is distinct from Product's 'PRODUCT#${status}'
GSI1PK: { type: String, value: 'CATEGORY', hidden: false },
GSI1SK: { type: String, value: '${name}', hidden: false },
```

---

## Value Template Syntax

Value templates are strings with `${fieldName}` placeholders. OneTable resolves them at runtime using the model attributes.

```typescript
// Composite key combining two attributes:
GSI1PK: { type: String, value: 'USER#${userRole}#${userStatus}', hidden: false }

// Single attribute key:
GSI1SK: { type: String, value: '${email}', hidden: false }

// Static prefix only (for top-level entity type segregation):
PK: { type: String, value: 'USER', hidden: false }
```

`hidden: false` means the GSI key attribute is returned in query results, which is **required** for the pagination cursor mechanism in `pageRecordHandler`.

---

## Common Pitfalls

### Pitfall 1 — Omitting `hidden: false` on GSI key fields
If a GSI key field has `hidden: true` (the default), `pageRecordHandler` cannot read the cursor key values from raw records. Always set `hidden: false` on every GSI key field used for pagination.

### Pitfall 2 — Single-value hash key on a paginated GSI
Example of wrong design:
```typescript
GSI6PK: { type: String, value: 'USER#', hidden: false }  // all users share the same PK
```
This creates a hot partition. Avoid this for large datasets. For admin-style "list all" use a GSI that distributes by a meaningful attribute.

### Pitfall 3 — Using `generate: 'ulid'` on a field that must be provided
`generate: 'ulid'` auto-creates a value when the field is absent on create. Only use it for the primary entity ID. All other fields that must be set by application code should be `required: true` without `generate`.

### Pitfall 4 — Missing `as const` on `models`
The `} as const` on the models block is required for the `Entity<typeof Schema.models.X>` type to work correctly. Never omit it.

---

## `params` Block

Always include:
```typescript
params: {
  isoDates: true,   // stores dates as ISO strings
  timestamps: true, // auto-manages createdAt and updatedAt fields
},
```

`timestamps: true` means OneTable automatically adds `createdAt` and `updatedAt` to every record. These fields do not need to be declared in the model schema. **Important:** `createdAt` is a persistence-only field managed by OneTable. Domain entities use `dateCreated` instead. The repository reads `record.createdAt` from OneTable and maps it to `dateCreated` in the entity. The repository must cast the raw type to include them:
```typescript
const record = raw as {Entity}DataType & { createdAt?: Date | string; updatedAt?: Date | string };
```

---

## Export Type

Always export the `Entity<>` type at the bottom of the schema file:
```typescript
export type {Entity}DataType = Entity<typeof {Entity}Schema.models.{Entity}>;
```

This type is used exclusively in the repository's `toDomain()` and `toPersistence()` methods and in the local `I{Entity}Model` interface.

---

## Barrel Export

Add to `src/infrastructure/index.ts`:
```typescript
export { {Entity}Schema } from './schemas/{Entity}Schema';
export type { {Entity}DataType } from './schemas/{Entity}Schema';
export { Dynamo{Entity}Repository } from './repositories/dynamo-{entity}.repository';
```

---

## Update LocalStack Setup Script (MANDATORY — Do Not Skip)

Every time a schema is **created** or its **GSI indexes change**, `scripts/setup-localstack.ts` must be updated so that the LocalStack DynamoDB table mirrors the current schema.

### Single-table design rule

All schemas that share the same physical table (same `{DOMAIN}_DYNAMODB_TABLE_NAME` env var value) are merged into **one** `TABLE_CONFIGS` entry. The `attributeDefinitions` and `gsis` arrays in that entry must always be the **union** of all GSIs from every schema targeting that table.

### Steps to follow

**1. Identify the physical table name.**
Open `.env.local` and check the `{DOMAIN}_DYNAMODB_TABLE_NAME` value for this domain (e.g. `USERS_DYNAMODB_TABLE_NAME=OldSTTable`).

**2. Find (or add) the matching `TABLE_CONFIGS` entry in `scripts/setup-localstack.ts`.**
- If an entry with the same `tableName` already exists → update it (Steps 3–4).
- If this domain uses a new physical table name with no existing entry → add a new `TableConfig` object following the commented example at the bottom of `TABLE_CONFIGS`.

**3. For every new GSI in the schema:**

a. Add its key attribute(s) to `attributeDefinitions` (type `'S'` for String, `'N'` for Number):
```typescript
{ name: 'GSINPK', type: 'S' },
{ name: 'GSINSK', type: 'S' }, // omit if hash-only GSI
```

b. Add the GSI to the `gsis` array:
```typescript
{ indexName: 'GSIN', hashKey: 'GSINPK', sortKey: 'GSINSK' }, // sortKey optional
```

c. Add an inline comment describing which schema/access-pattern the GSI serves.

d. Update the comment block above `gsis` to document which domain contributes the new index.

**4. For every removed GSI:**
a. Remove it from `gsis`.
b. Remove its key attributes from `attributeDefinitions` only if no other GSI in the same table still uses those attribute names.

**5. Apply the changes to LocalStack:**
```bash
pnpm run localstack:setup:force
# or: npx ts-node --project scripts/tsconfig.json scripts/setup-localstack.ts --force
```
> `--force` deletes and recreates the table. Required whenever GSIs change because DynamoDB does not support modifying a GSI key schema in-place.

### Example — adding GSI7 for UserSchema

Schema change in `UserSchema.ts`:
```typescript
indexes: {
  // ... existing
  GSI7: { hash: 'GSI7PK', sort: 'GSI7SK' },
},
models: {
  User: {
    // ...
    GSI7PK: { type: String, value: 'USER#${country}', hidden: false },
    GSI7SK: { type: String, value: '${userId}',       hidden: false },
  }
}
```

`scripts/setup-localstack.ts` update (inside the `OldSTTable` entry):
```typescript
// attributeDefinitions — add:
{ name: 'GSI7PK', type: 'S' },
{ name: 'GSI7SK', type: 'S' },

// gsis — add:
{ indexName: 'GSI7', hashKey: 'GSI7PK', sortKey: 'GSI7SK' }, // UserSchema: list users by country
```

Then run: `pnpm run localstack:setup:force`

---

## Multi-Model Aggregate Schema

When a domain entity is an **aggregate root** with child entities (e.g. Order + OrderItem + OrderPayment), all models live in **one schema file**. Each model shares the same partition key prefix (the root's ID) but uses a different sort key prefix to distinguish entity types.

### Aggregate Schema Template

```typescript
import { Entity } from 'dynamodb-onetable';
import { ROOT_STATUSES, CHILD_STATUSES } from '../../domain/constants';

export const {Root}Schema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' },
    // ... additional GSIs for access patterns across all models
  },
  models: {
    // ── Root entity ──────────────────────────────────────────────────────────
    {Root}: {
      PK: { type: String, value: '{ROOT}#${{{root}Id}}', hidden: false },
      SK: { type: String, value: 'METADATA', hidden: false },        // fixed sort key
      {root}Id: { type: String, generate: 'ulid' },
      // ... root fields
      dateCreated: { type: String },
    },

    // ── Child entity (collection) ────────────────────────────────────────────
    {Child}: {
      PK: { type: String, value: '{ROOT}#${{{root}Id}}', hidden: false },  // same PK as root
      SK: { type: String, value: '{CHILD}#{${childId}}', hidden: false },   // distinguishing prefix
      childId: { type: String, generate: 'ulid' },
      {root}Id: { type: String, required: true },                           // back-reference
      // ... child fields
      dateCreated: { type: String },
    },

    // ── Child entity (singular, optional) ────────────────────────────────────
    {Payment}: {
      PK: { type: String, value: '{ROOT}#${{{root}Id}}', hidden: false },
      SK: { type: String, value: 'PAYMENT#${paymentId}', hidden: false },
      paymentId: { type: String, generate: 'ulid' },
      {root}Id: { type: String, required: true },
      // ... payment fields
      dateCreated: { type: String },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};

// Export ONE type per model — the repository uses these for toDomain/toPersistence
export type {Root}DataType = Entity<typeof {Root}Schema.models.{Root}>;
export type {Child}DataType = Entity<typeof {Root}Schema.models.{Child}>;
export type {Payment}DataType = Entity<typeof {Root}Schema.models.{Payment}>;
```

### Aggregate Primary Key Design

| Model | PK value template | SK value template | Purpose |
|---|---|---|---|
| Root (Order) | `{ROOT}#${rootId}` | `METADATA` | One root record per aggregate |
| Child collection (OrderItem) | `{ROOT}#${rootId}` | `{CHILD}#${childId}` | N children sharing root's partition |
| Singular child (Payment) | `{ROOT}#${rootId}` | `PAYMENT#${paymentId}` | 0..1 child in root's partition |

**Key insight:** All models in an aggregate share the **same PK value** (the root's ID). This enables loading the entire aggregate with a single partition query (`PK = 'ORDER#123'`), then filtering by SK prefix to separate entity types.

### Access Pattern GSIs for Aggregate Schemas

| Access Pattern | GSI | Hash (PK) | Sort (SK) | Which model |
|---|---|---|---|---|
| Orders by customer | GSI1 | `CUSTOMER#${customerId}` | `ORDER#${dateCreated}` | Root only |
| Items by product (cross-ref) | GSI2 | `PRODUCT#${productId}` | `ORDER#${orderId}#${dateCreated}` | Child only |
| Orders by status | GSI3 | `ORDER#${orderStatus}` | `${dateCreated}` | Root only |

**Rules for multi-model GSIs:**
- Each model only populates the GSI key fields it needs. Models that don't participate in a GSI simply don't define those GSI key fields.
- Child models that need their own access patterns (e.g. "find all order items for product X") get their own GSI key fields on the child model.
- The root's back-reference field (`{root}Id`) on child models is `required: true` — it's needed for partition-scoped queries.
