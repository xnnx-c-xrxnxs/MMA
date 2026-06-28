---
name: new-prisma-schema
description: Create a Prisma schema for a new domain entity. Use this when adding a schema file to packages/{domain}-domain/src/infrastructure/prisma/schema.prisma. Covers model definition, enum mirroring from domain constants, relation design (FK + cascade), index creation for query patterns, @default(uuid()) ID strategy, prisma generate + migrate workflow, and output configuration.
---

# Creating a Prisma Schema

Official docs: https://www.prisma.io/docs/orm/prisma-schema

---

## Required Information — Ask Before Starting

Before generating the schema, confirm all requirements with the developer:

1. What are the entity's fields and their types? (string, number, boolean, DateTime, enum)
2. What are the access patterns? (lookup by ID, list by status, filter by owner, etc.)
3. Are there child entities? (1:N or 1:1 relationships — e.g. Order→OrderItem, Order→OrderPayment)
4. Which fields need indexes for list/filter queries?
5. What enums are needed? (Must mirror domain constants exactly.)
6. What is the database URL env var name? (e.g. `ORDERS_DATABASE_URL`)

---

## File Location

```
packages/{domain}-domain/src/infrastructure/prisma/schema.prisma
```

The Prisma schema lives alongside the domain's infrastructure code. Each domain that uses Prisma gets its own `schema.prisma` file.

---

## Schema Template

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Prisma Schema — {Domain} Domain
//
// Generate client:  pnpm prisma:{domain}:generate
// Create migration: pnpm prisma:{domain}:migrate:dev
// Deploy migration: pnpm prisma:{domain}:migrate:deploy
// Browse data:      pnpm prisma:{domain}:studio
// ─────────────────────────────────────────────────────────────────────────────

generator client {
  provider      = "prisma-client-js"
  output        = "../generated/client"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("{DOMAIN}_DATABASE_URL")
}

// ─── Enums (mirror domain constants exactly) ─────────────────────────────────
// Values MUST match packages/{domain}-domain/src/domain/constants/*

enum {Entity}Status {
  ACTIVE
  INACTIVE
  PENDING
  // ... values from {ENTITY}_STATUSES constant
}

// ─── Models ──────────────────────────────────────────────────────────────────

model {Entity} {
  {entity}Id    String         @id @default(uuid())
  field1        String
  field2        String
  {entity}Status {Entity}Status @default(PENDING)
  dateCreated   DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  // Relations (if aggregate root)
  items   {Child}[]
  payment {Payment}?

  // Indexes for query patterns
  @@index([field1])
  @@index([{entity}Status])
  @@map("{entities}")            // lowercase plural table name
}
```

---

## Generator Configuration

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../generated/client"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

**Rules:**
- `output` must always be `"../generated/client"` — relative to the `schema.prisma` file location.
- This generates the Prisma client into `packages/{domain}-domain/src/infrastructure/generated/client/`.
- The generated client is infrastructure-only. Domain and application layers must never import from it.
- Add `generated/` to `.gitignore` for the domain package if it isn't already ignored.

---

## Datasource Configuration

```prisma
datasource db {
  provider = "postgresql"
  url      = env("{DOMAIN}_DATABASE_URL")
}
```

**Rules:**
- Use `env()` to read the database URL from environment variables.
- Naming convention: `{DOMAIN}_DATABASE_URL` (e.g. `ORDERS_DATABASE_URL`, `PAYMENTS_DATABASE_URL`).
- The actual value in `.env.local` follows the pattern: `postgresql://{user}:{password}@localhost:{port}/{db_name}`.
- For local development, the PostgreSQL instance runs in Docker (see `docker-compose.yml`).

---

## Enum Design — Mirror Domain Constants

Prisma enums **must** match the domain constants exactly. The enum values in the Prisma schema are the single source of truth for the database, but they must be kept in sync with domain constants.

```prisma
// Prisma enum — values must match ORDER_STATUSES in domain/constants
enum OrderStatus {
  DRAFT
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}
```

```typescript
// Domain constant — the source of truth for business logic
export const ORDER_STATUSES = [
  'DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING',
  'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
] as const;
```

**Rules:**
- When adding a new enum value, add it to both the domain constant AND the Prisma schema.
- Run `prisma migrate dev` to create a migration for the enum change.
- Never define a Prisma enum value that does not exist in domain constants.

---

## Model Design

### Primary Key

```prisma
{entity}Id  String  @id @default(uuid())
```

- Always use UUID for primary keys via `@default(uuid())`.
- Naming convention: `{entity}Id` (e.g. `orderId`, `paymentId`).
- This replaces DynamoDB's ULID pattern (`generate: 'ulid'`).

### Timestamps

```prisma
dateCreated  DateTime  @default(now())
updatedAt    DateTime  @updatedAt
```

- `dateCreated` uses `@default(now())` — set once on creation.
- `updatedAt` uses `@updatedAt` — Prisma auto-updates on every write.
- These are always `DateTime` type, never `String`. The repository converts to ISO string via `.toISOString()`.
- Never add a `createdAt` field — the domain uses `dateCreated` only.

### Table Mapping

```prisma
@@map("{entities}")    // lowercase plural table name
```

Use `@@map` to control the physical table name. Convention: lowercase plural (e.g. `"orders"`, `"order_items"`, `"users"`).

---

## Relations

### One-to-Many (Parent → Children collection)

```prisma
model Order {
  orderId  String      @id @default(uuid())
  items    OrderItem[]
  // ...
}

model OrderItem {
  itemId   String  @id @default(uuid())
  orderId  String
  order    Order   @relation(fields: [orderId], references: [orderId], onDelete: Cascade)
  // ...
}
```

### One-to-One (Parent → Optional singular child)

```prisma
model Order {
  orderId  String        @id @default(uuid())
  payment  OrderPayment?
  // ...
}

model OrderPayment {
  paymentId  String  @id @default(uuid())
  orderId    String  @unique       // @unique enforces 1:1
  order      Order   @relation(fields: [orderId], references: [orderId], onDelete: Cascade)
  // ...
}
```

**Rules:**
- Always use `onDelete: Cascade` for aggregate children — deleting the root removes all children.
- The foreign key field (e.g. `orderId` on `OrderItem`) must match the parent's `@id` field type.
- For 1:1 relations, add `@unique` on the foreign key field.

---

## Index Design

Create indexes for every confirmed query pattern:

```prisma
@@index([customerId])      // find orders by customer
@@index([orderStatus])     // find orders by status
@@index([productId])       // find items by product (on child model)
```

**Decision table:**

| Access Pattern | Index Definition | On Which Model |
|---|---|---|
| List by owner/customer | `@@index([customerId])` | Root |
| List by status | `@@index([{entity}Status])` | Root |
| List by child field | `@@index([productId])` | Child |
| Unique lookup by field | `@unique` on the field | Applicable model |
| Composite filter | `@@index([field1, field2])` | Applicable model |

**Rules:**
- Only create indexes for confirmed access patterns. Don't index speculatively.
- Composite indexes should list the most selective field first.
- For unique lookups (e.g. by email), use `@unique` on the field instead of `@@index`.
- Unlike DynamoDB GSIs, Prisma indexes don't need LocalStack setup — they're handled by `prisma migrate`.

---

## Migration Workflow

### Adding npm Scripts

Add these scripts to the root `package.json`:

```json
{
  "scripts": {
    "prisma:{domain}:generate": "prisma generate --schema=packages/{domain}-domain/src/infrastructure/prisma/schema.prisma",
    "prisma:{domain}:migrate:dev": "prisma migrate dev --schema=packages/{domain}-domain/src/infrastructure/prisma/schema.prisma",
    "prisma:{domain}:migrate:deploy": "prisma migrate deploy --schema=packages/{domain}-domain/src/infrastructure/prisma/schema.prisma",
    "prisma:{domain}:studio": "prisma studio --schema=packages/{domain}-domain/src/infrastructure/prisma/schema.prisma"
  }
}
```

### Register in the Centralized Migration Script

Open `scripts/prisma-migrate-all.ts` and add an entry to `PRISMA_DOMAINS`:

```typescript
{
  name: '{domain}-domain',
  schemaPath: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
  envVar: '{DOMAIN}_DATABASE_URL',
},
```

This ensures `DB: Migrate All` (VS Code task) applies pending migrations for the new domain automatically when running `Dev: Start All`.

### Development Workflow

```bash
# 1. Edit schema.prisma

# 2. Create a migration (prompts for migration name)
pnpm prisma:{domain}:migrate:dev

# 3. Generate the client (auto-runs after migrate:dev, but can be run separately)
pnpm prisma:{domain}:generate

# 4. Verify schema visually
pnpm prisma:{domain}:studio
```

### CI/CD Deployment

```bash
# Apply pending migrations (no prompt, no client generation)
pnpm prisma:{domain}:migrate:deploy

# Generate client (needed for build)
pnpm prisma:{domain}:generate
```

---

## Docker Postgres Setup

Each Prisma-based domain needs a PostgreSQL database. Add a service to `docker-compose.yml`:

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: dev
    POSTGRES_PASSWORD: dev
    POSTGRES_DB: {domain}_db
  ports:
    - '5432:5432'
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U dev']
    interval: 5s
    timeout: 5s
    retries: 5
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**Rules:**
- If multiple domains share the same PostgreSQL instance, they can use different databases or schemas. For simplicity, each domain gets its own database.
- The `DATABASE_URL` env var points to the specific database: `postgresql://dev:dev@localhost:5432/{domain}_db`.
- Multiple Prisma domains sharing one Postgres server: each domain's `schema.prisma` has a different `env()` var pointing to a different database name.

---

## Key Differences from DynamoDB Schema

| Aspect | DynamoDB (OneTable Schema) | Prisma (schema.prisma) |
|---|---|---|
| File format | TypeScript object (`{Entity}Schema`) | Prisma DSL (`.prisma` file) |
| Location | `infrastructure/schemas/{Entity}Schema.ts` | `infrastructure/prisma/schema.prisma` |
| ID strategy | `generate: 'ulid'` (application-level) | `@default(uuid())` (database-level) |
| Enums | Domain constant arrays (e.g. `ORDER_STATUSES`) | `enum` blocks (must mirror domain constants) |
| Relationships | Same partition key + different SK prefix | Foreign keys + `@relation` |
| Indexes | GSI definitions in `indexes` block + LocalStack setup | `@@index` annotations + `prisma migrate` |
| Timestamps | `params: { timestamps: true }` + manual `createdAt` cast | `@default(now())` + `@updatedAt` |
| Type export | `Entity<typeof Schema.models.X>` | Auto-generated by `prisma generate` |
| Migration | Manual table recreation via `localstack:setup:force` | `prisma migrate dev` (incremental) |

---

## Barrel Export

Add to `src/infrastructure/index.ts`:
```typescript
export * from './repositories';
export { PrismaClient } from './generated/client';
```

This exports the Prisma repository and re-exports `PrismaClient` for use in the service's config/module wiring.
