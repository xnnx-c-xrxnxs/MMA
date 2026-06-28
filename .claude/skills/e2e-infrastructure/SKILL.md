---
name: e2e-infrastructure
description: Add E2E infrastructure for a new domain. Use this when extending the E2E test setup with new DynamoDB tables, Postgres databases, or SQS queues. Covers updating scripts/setup-e2e.ts, scripts/teardown-e2e.ts, .env.e2e.example, and CI workflow env vars.
---

# E2E Infrastructure Setup

Canonical references:
- `scripts/setup-e2e.ts` — Creates E2E-specific DynamoDB tables, SQS queues, and Postgres databases
- `scripts/teardown-e2e.ts` — Destroys E2E infrastructure
- `.env.e2e.example` — Template for E2E environment variables
- `scripts/setup-localstack.ts` — Reference for table/queue creation patterns

E2E tests use isolated infrastructure to avoid interfering with local development data.

---

## Data Isolation Strategy

| Resource | Dev (`.env.local`) | E2E (`.env.e2e`) |
|---|---|---|
| DynamoDB tables | `OldSTTable` | `USERS_E2E`, `PRODUCTS_E2E` |
| Postgres database | `orders_db` | `orders_e2e_db` |
| SQS queues | `users-events`, `order-events`, `product-events` | `users-events-e2e`, `order-events-e2e`, `product-events-e2e` |

Both dev and E2E infrastructure run on the same LocalStack and Postgres instances. Only the resource names differ.

---

## Step-by-Step: Add E2E Infrastructure for a New Domain

### 1. Determine resource type

- **DynamoDB domain** (like user, product): Add table config to `setup-e2e.ts`
- **Prisma domain** (like order): Add database creation to `setup-e2e.ts`
- **SQS queues** (event-driven services): Add queue config to `setup-e2e.ts`

### 2. Update `scripts/setup-e2e.ts`

#### For a new DynamoDB table

Add to the `TABLE_CONFIGS` array:

```typescript
{
  tableName: '{DOMAIN}_E2E',
  partitionKey: 'pk',
  sortKey: 'sk',
  gsis: [
    { name: 'GSI1', partitionKey: 'gs1pk', sortKey: 'gs1sk' },
    // Add GSIs matching the domain's schema
  ],
}
```

**Match the GSIs exactly** from the domain's OneTable schema (`packages/{domain}-domain/src/infrastructure/schemas/`).

#### For a new Postgres database

Add the database name to the Postgres setup section:

```typescript
const E2E_DATABASES = ['orders_e2e_db', '{new_domain}_e2e_db'];
```

If the domain uses Prisma migrations, add the migration step:

```typescript
const PRISMA_E2E_DOMAINS = [
  {
    name: '{domain}-domain',
    schemaPath: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
    databaseUrl: process.env.{DOMAIN}_DATABASE_URL,
  },
  {
    name: '{new-domain}-domain',
    schemaPath: 'packages/{new-domain}-domain/src/infrastructure/prisma/schema.prisma',
    databaseUrl: process.env.{NEW_DOMAIN}_DATABASE_URL,
  },
];
```

#### For a new SQS queue

Add to the `QUEUE_CONFIGS` array:

```typescript
{
  queueName: '{domain}-events-e2e',
}
```

### 3. Update `scripts/teardown-e2e.ts`

Add the matching teardown for each new resource:
- DynamoDB table: `deleteTable('{DOMAIN}_E2E')`
- Postgres database: `dropDatabase('{domain}_e2e_db')`
- SQS queue: `deleteQueue('{domain}-events-e2e')`

### 4. Update `.env.e2e.example`

Add the new environment variables:

```bash
# {Domain} domain (DynamoDB)
{DOMAIN}_DYNAMODB_TABLE_NAME={DOMAIN}_E2E

# {Domain} domain (Prisma)
{DOMAIN}_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}_e2e_db

# {Domain} SQS
{DOMAIN}_SQS_QUEUE_NAME={domain}-events-e2e
{DOMAIN}_SQS_QUEUE_URL=http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/{domain}-events-e2e
```

### 5. Update `.github/service-registry.env`

All E2E env vars are loaded dynamically by `ci-e2e.yml` via:

```bash
grep -v '^\s*#' .github/service-registry.env | grep -v '^\s*$' >> $GITHUB_ENV
```

Add a new section for the domain at the bottom of `.github/service-registry.env`:

```bash
# --- {Domain} domain (DynamoDB) ---
{DOMAIN}_SERVICE_PORT={PORT}
API_{DOMAIN}_URL=http://localhost:{PORT}/api
NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{PORT}/api
{DOMAIN}S_DYNAMODB_TABLE_NAME={DOMAIN}S_E2E
{DOMAIN}_SQS_QUEUE_NAME={domain}-events-e2e
{DOMAIN}_SQS_QUEUE_URL=http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/{domain}-events-e2e

# --- {Domain} domain (Prisma) ---
{DOMAIN}_SERVICE_PORT={PORT}
API_{DOMAIN}_URL=http://localhost:{PORT}/api
NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{PORT}/api
{DOMAIN}S_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}s_e2e_db
```

> **Prisma only:** You must also add a `postgres` service container to `ci-e2e.yml` (both `api-e2e-tests` and `webapp-e2e-tests` jobs) and to `ci-test-all.yml`. No `ci-e2e.yml` env block changes are needed for DynamoDB domains — `service-registry.env` handles those automatically.

### 6. Update API helpers

Add helper functions for the new domain in `test/e2e/api-helpers.ts`:

```typescript
const {DOMAIN}_API = process.env.API_{DOMAIN}_URL || 'http://localhost:{PORT}/api';

export async function create{Entity}(data: Record<string, unknown>) {
  return axios.post(`${encodeURI({DOMAIN}_API)}/v1/{entities}`, data);
}

export async function get{Entity}(id: string) {
  return axios.get(`${encodeURI({DOMAIN}_API)}/v1/{entities}/${encodeURIComponent(id)}`);
}

// ... delete, list, action endpoints
```

### 7. Update test data factories

Add a factory in `test/e2e/test-data.ts`:

```typescript
let {entity}Counter = 0;

export function generate{Entity}Data(overrides: Record<string, unknown> = {}) {
  {entity}Counter++;
  return {
    name: `E2E {Entity} ${Date.now()}-${entityCounter}`,
    // ... other required fields
    ...overrides,
  };
}
```

---

## Checklist

- [ ] Update `scripts/setup-e2e.ts` with new table/database/queue configs
- [ ] Update `scripts/teardown-e2e.ts` with matching teardown
- [ ] Update `.env.e2e.example` with new environment variables
- [ ] Update `.github/service-registry.env` with new domain E2E vars
- [ ] Run `pnpm ts-node --project scripts/tsconfig.json scripts/lint-standards.ts` to verify `service-registry-env-sync` passes (validates env vars are declared in both `service-registry.json` and `service-registry.env`)
- [ ] **Prisma only:** Add a `postgres` service container to `ci-e2e.yml` (both jobs) and `ci-test-all.yml`
- [ ] Add API helper functions in `test/e2e/api-helpers.ts`
- [ ] Add factory function in `test/e2e/test-data.ts`
- [ ] Run `pnpm e2e:setup` locally to verify infrastructure creates successfully
- [ ] Run `pnpm e2e:teardown` locally to verify cleanup works
