---
name: write-api-e2e-tests
description: Scaffold and write E2E tests for a backend API service. Use this when creating a new {service}-e2e project or adding E2E test specs for an existing API service. Covers project setup, global fixtures, CRUD test suites, status transitions, pagination, error cases, and data isolation.
---

# Writing API E2E Tests

Canonical references:
- `test/e2e/api-helpers.ts` — shared typed API helpers
- `test/e2e/test-data.ts` — shared test data factories
- `test/e2e/wait-for-services.ts` — service health check utility

Tests run with Jest + axios against real running backend services with isolated E2E infrastructure (separate DynamoDB tables, Postgres database, and SQS queues).

---

## Project Structure

```
apps/{domain}/{service}-e2e/
  project.json                  ← Nx project (tags: scope:{domain}, type:e2e)
  jest.config.cts               ← Jest config with global setup/teardown
  tsconfig.json                 ← extends ../../tsconfig.base.json
  tsconfig.spec.json            ← test-specific tsconfig
  src/
    support/
      global-setup.ts           ← runs before all tests (wait for services)
      global-teardown.ts        ← runs after all tests (cleanup)
      test-setup.ts             ← per-test-file setup (increase timeout)
    {service}/
      {entity}-crud.spec.ts     ← CRUD operations
      {entity}-actions.spec.ts  ← Status transitions, business actions
      {entity}-filtering.spec.ts ← Filtering, pagination, search
```

---

## Step-by-Step: New API E2E Project

### 1. Create `project.json`

```json
{
  "name": "{service}-e2e",
  "sourceRoot": "apps/{domain}/{service}-e2e/src",
  "projectType": "application",
  "tags": ["scope:{domain}", "type:e2e"],
  "implicitDependencies": ["{service}"]
}
```

### 2. Create `jest.config.cts`

```typescript
export default {
  displayName: '{service}-e2e',
  preset: '../../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  setupFilesAfterSetup: ['<rootDir>/src/support/test-setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
```

### 3. Create `tsconfig.json` and `tsconfig.spec.json`

Use the same pattern as any existing `{service}-e2e/tsconfig.json` in the workspace.

### 4. Create support files

**`global-setup.ts`** — Calls `waitForServices()` from shared helpers:

```typescript
import { waitForServices } from '../../../../test/e2e/wait-for-services';

export default async function globalSetup() {
  await waitForServices();
}
```

**`global-teardown.ts`** — Placeholder for cleanup if needed:

```typescript
export default async function globalTeardown() {
  // Cleanup runs after all E2E tests complete
}
```

**`test-setup.ts`** — Increase Jest timeout for E2E:

```typescript
jest.setTimeout(30_000);
```

### 5. Register in `nx.json` Jest plugin exclude

Add to `nx.json` → `plugins` → Jest plugin → `exclude` array:
```
"apps/{domain}/{service}-e2e/**/*"
```

This prevents the Nx Jest plugin from auto-detecting the E2E project (it has its own `e2e` target inferred).

---

## Test Patterns

### CRUD Test Suite

```typescript
import { createUser, deleteUser, getUser } from '../../../../test/e2e/api-helpers';
import { generateUserData } from '../../../../test/e2e/test-data';

describe('{Entity} CRUD', () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    // Cleanup all created entities
    for (const id of createdIds) {
      await deleteEntity(id).catch(() => {});
    }
  });

  it('should create a {entity}', async () => {
    const data = generateEntityData();
    const response = await createEntity(data);
    
    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      ...data,
      status: 'EXPECTED_INITIAL_STATUS',
    });
    
    createdIds.push(response.data.{entity}Id);
  });

  it('should get {entity} by ID', async () => {
    const createRes = await createEntity(generateEntityData());
    createdIds.push(createRes.data.{entity}Id);
    
    const getRes = await getEntity(createRes.data.{entity}Id);
    expect(getRes.status).toBe(200);
    expect(getRes.data.{entity}Id).toBe(createRes.data.{entity}Id);
  });

  it('should return 404 for non-existent {entity}', async () => {
    try {
      await getEntity('non-existent-id');
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.response.status).toBe(404);
    }
  });

  it('should delete a {entity}', async () => {
    const createRes = await createEntity(generateEntityData());
    const deleteRes = await deleteEntity(createRes.data.{entity}Id);
    expect(deleteRes.status).toBe(204);
  });
});
```

### Status Transition Test Suite

```typescript
describe('{Entity} Status Transitions', () => {
  let entityId: string;

  beforeEach(async () => {
    const res = await createEntity(generateEntityData());
    entityId = res.data.{entity}Id;
  });

  afterEach(async () => {
    await deleteEntity(entityId).catch(() => {});
  });

  it('should transition from INITIAL to NEXT_STATUS', async () => {
    const res = await performAction(entityId);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('NEXT_STATUS');
  });

  it('should reject invalid transition', async () => {
    try {
      await performInvalidAction(entityId);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.response.status).toBe(409);
    }
  });
});
```

### Cross-Domain Seeding

When testing a domain that depends on another (e.g., orders need users + products):

```typescript
beforeAll(async () => {
  // Seed dependencies from other domains
  const userRes = await createUser(generateUserData());
  customerId = userRes.data.userId;
  
  // Activate the user so it's valid for order creation
  await verifyUserEmail(customerId);
  await activateUser(customerId);
  
  const productRes = await createProduct(generateProductData({ categoryId }));
  productId = productRes.data.productId;
  await activateProduct(productId);
});

afterAll(async () => {
  await deleteProduct(productId).catch(() => {});
  await deleteUser(customerId).catch(() => {});
});
```

---

## Shared Utilities

### `test/e2e/api-helpers.ts`

Provides typed wrappers for all API endpoints:
- `createUser(data)`, `getUser(id)`, `deleteUser(id)`, etc.
- `createProduct(data)`, `activateProduct(id)`, etc.
- `createOrder(data)`, `cancelOrder(id)`, etc.

Each returns the full axios response object for status code assertions.

### `test/e2e/test-data.ts`

Provides factory functions with built-in uniqueness:
- `generateUserData(overrides?)` — unique email via counter
- `generateProductData(overrides?)` — unique name, requires `categoryId`
- `generateOrderData(overrides?)` — requires `customerId` + items array
- `generateCategoryData(overrides?)` — unique name

### `test/e2e/wait-for-services.ts`

Polls health endpoints with configurable timeout. Used in `global-setup.ts`.

---

## Data Isolation Rules

- E2E tests use separate infrastructure: `USERS_E2E` / `PRODUCTS_E2E` DynamoDB tables, `orders_e2e_db` Postgres database
- Each test suite cleans up its own created entities in `afterAll` / `afterEach`
- Never share entity IDs between test files — each file is self-contained
- Use `scripts/setup-e2e.ts` to create E2E infrastructure before running tests
- Use `scripts/teardown-e2e.ts` to destroy E2E infrastructure after

---

## Checklist

- [ ] Create `apps/{domain}/{service}-e2e/project.json` with correct tags and implicitDependencies
- [ ] Create `jest.config.cts` with global setup/teardown
- [ ] Create `tsconfig.json` and `tsconfig.spec.json`
- [ ] Create `src/support/global-setup.ts`, `global-teardown.ts`, `test-setup.ts`
- [ ] Add E2E project to `nx.json` Jest plugin exclude
- [ ] Add CRUD spec — create, get, list, update, delete
- [ ] Add status transition spec — valid transitions, invalid transition errors
- [ ] Add filtering/pagination spec if applicable
- [ ] Ensure cleanup in `afterAll`/`afterEach` blocks
- [ ] If cross-domain dependencies exist, seed them in `beforeAll` and clean up in `afterAll`
- [ ] Add API helper methods for new endpoints in `test/e2e/api-helpers.ts`
- [ ] Add factory function for new entity in `test/e2e/test-data.ts`
