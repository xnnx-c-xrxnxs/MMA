# Testing Strategy for Clean Architecture

## 🎯 Testing Pyramid

```
                    ▲
                   /E2E\           ← Few, slow, expensive
                  /─────\            API/Integration tests
                 /       \
                /  API    \
               /───────────\
              /             \
             / Application   \    ← Moderate, with mocks
            /    Use Cases    \     Business workflows
           /───────────────────\
          /                     \
         /       Domain          \ ← Many, fast, cheap
        /   Entities & Logic     \  Pure business rules
       /─────────────────────────\
```

**Ratio: 70% Domain, 20% Application, 10% API/Integration**

---

## 📋 Testing by Layer

### 1. **Domain Layer** (70% of tests) ⭐

**Location:** `domain/entities/*.spec.ts`, `domain/constants/*.spec.ts`

**Test Type:** Pure Unit Tests (no mocks, no dependencies)

**What to Test:**
- ✅ Entity creation (factory methods)
- ✅ Business logic methods
- ✅ State transitions
- ✅ Domain validations
- ✅ Business rules enforcement
- ✅ Getter methods
- ✅ Edge cases and error conditions

**Why Most Tests Here:**
- **Zero external dependencies** = fast, deterministic
- **Core business logic** = highest value
- **Easy to test** = no setup required
- **Protects business rules** = prevents regression

**Example Files:**
- `packages/{domain}-domain/src/domain/entities/{entity}.entity.spec.ts`

**Running:**
```bash
# Test specific domain
nx test {domain}-domain

# Test all domains
nx run-many --target=test --projects=*-domain
```

---

### 2. **Application Layer** (20% of tests)

**Location:** `application/use-cases/*.spec.ts`

**Test Type:** Unit Tests with Mocked Dependencies

**What to Test:**
- ✅ Use case orchestration
- ✅ Repository calls
- ✅ Business workflow coordination
- ✅ Error handling
- ✅ Cross-domain integration logic
- ✅ Event publishing

**How:**
- Mock `IRepository` interfaces using Jest
- Verify correct method calls
- Test error propagation
- Test workflow logic

**Example Files:**
- `packages/{domain}-domain/src/application/use-cases/{operation}.use-case.spec.ts`
- `apps/{domain}/{domain}-api-service/src/application/use-cases/{operation}.use-case.spec.ts`

**Template:**
```typescript
describe('SomeUseCase', () => {
  let useCase: SomeUseCase;
  let mockRepository: jest.Mocked<IRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      // ... mock all methods
    } as any;

    useCase = new SomeUseCase(mockRepository);
  });

  it('should do something', async () => {
    mockRepository.findById.mockResolvedValue(someEntity);
    
    const result = await useCase.execute(input);
    
    expect(result).toEqual(expectedOutput);
    expect(mockRepository.save).toHaveBeenCalledWith(expectedEntity);
  });
});
```

---

### 3. **Infrastructure Layer** (5% of tests)

**Location:** `infrastructure/repositories/*.integration.spec.ts`

**Test Type:** Integration Tests (real database)

**What to Test:**
- ✅ Repository implementation correctness
- ✅ Database queries and GSIs
- ✅ Data persistence
- ✅ toDomain/toPersistence conversion
- ✅ Transaction handling

**Setup Required:**
- DynamoDB Local or LocalStack
- Test database instance
- Cleanup between tests

**Example Files:**
- `packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.integration.spec.ts`

**Setup:**
```bash
# Start LocalStack (run once per dev session)
docker compose up -d

# Run integration tests
nx test {domain}-domain --testPathPattern=integration
```

**Template:**
```typescript
describe('Repository (Integration)', () => {
  let repository: DynamoRepository;
  let table: Table;

  beforeAll(async () => {
    table = await createTable(Schema, {
      endpoint: 'http://localhost:4566',
    });
    repository = new DynamoRepository(table);
  });

  afterEach(async () => {
    // Clean up test data
  });

  it('should save and retrieve entity', async () => {
    const entity = Entity.create({...});
    const saved = await repository.save(entity);
    
    const retrieved = await repository.findById(saved.id);
    expect(retrieved).toEqual(saved);
  });
});
```

---

### 4. **Presentation Layer** (5% of tests)

**Location:** `presentation/controllers/*.spec.ts` or `*.e2e-spec.ts`

**Test Type:** API/E2E Tests

**What to Test:**
- ✅ HTTP endpoint responses
- ✅ Request validation (Zod schemas)
- ✅ Status codes
- ✅ Authentication/Authorization
- ✅ Error responses

**Tools:**
- NestJS Testing utilities
- Supertest for HTTP
- Mock use cases

**Example Files:**
- `apps/{domain}/{domain}-api-service/src/presentation/controllers/{entity}.controller.spec.ts`
- `apps/{domain}/{domain}-api-service-e2e/src/{entity}s.e2e-spec.ts`

**Template:**
```typescript
describe('API E2E', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('POST /users should create user', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', ... })
      .expect(201)
      .expect((res) => {
        expect(res.body.userId).toBeDefined();
      });
  });
});
```

---

### 5. **Frontend Layer** (webapp + mobile)

**Test Type:** Component Tests (Jest + Testing Library)

**What to Test:**
- ✅ Domain tables/lists render rows correctly
- ✅ Status badge variants match entity status
- ✅ Conditional action buttons by entity state
- ✅ Empty states and loading states
- ✅ Navigation on item press (mobile)
- ✅ Status-variant pure function mapping

**Webapp (Next.js):**
```bash
pnpm nx test webapp
```

**Mobile (Expo / React Native):**
```bash
pnpm nx test mobile
```

**Shared Data-Access Layer (`@mma/client-common`):**
- API clients: mock `globalThis.fetch`, verify URL construction and Zod parsing
- React Query hooks: `renderHook()` + `QueryClientProvider` wrapper

```bash
pnpm nx test client-common
```

---

## 🗂️ Complete File Structure

```
packages/{domain}-domain/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── {entity}.entity.ts
│   │   │   └── {entity}.entity.spec.ts              ← Domain unit tests (70%)
│   │   └── constants/
│   │       ├── {entity}-statuses.ts
│   │       └── {entity}-statuses.spec.ts
│   │
│   ├── application/
│   │   ├── interfaces/
│   │   │   └── {entity}-repository.interface.ts
│   │   └── use-cases/
│   │       ├── create-{entity}.use-case.ts
│   │       └── create-{entity}.use-case.spec.ts     ← Application tests (20%)
│   │
│   └── infrastructure/
│       ├── schemas/
│       │   └── {Entity}Schema.ts
│       └── repositories/
│           ├── dynamo-{entity}.repository.ts
│           └── dynamo-{entity}.repository.integration.spec.ts  ← Integration (5%)
│
└── jest.config.ts

apps/{domain}/{domain}-api-service/
├── src/
│   ├── application/
│   │   └── services/
│   │       ├── {entity}-application.service.ts
│   │       └── {entity}-application.service.spec.ts  ← Service tests
│   └── presentation/
│       └── controllers/
│           ├── {entity}.controller.ts
│           └── {entity}.controller.spec.ts           ← API unit tests

apps/{domain}/{domain}-api-service-e2e/
└── src/
    └── {entity}s.e2e-spec.ts                         ← E2E tests (5%)
```

> **Reference implementation:** see [examples/](examples/) for working `user-domain`, `product-domain`, and `order-domain` packages with full test coverage.

---

## 🛠️ Jest Configuration

**For Domain/Application Tests:**
```json
// packages/{domain}-domain/jest.config.ts
export default {
  displayName: '{domain}-domain',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: [
    '**/*.spec.ts',
    '!**/*.integration.spec.ts'  // Exclude integration tests
  ],
  coverageDirectory: '../../coverage/packages/{domain}-domain',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**For Integration Tests:**
```json
// jest.integration.config.ts
export default {
  displayName: 'integration',
  testEnvironment: 'node',
  testMatch: ['**/*.integration.spec.ts'],
  testTimeout: 30000,  // Longer timeout for DB operations
};
```

---

## 🚀 Running Tests

### By Layer
```bash
# Domain layer only (fast, no dependencies)
nx test user-domain
nx test product-domain
nx test order-domain

# All domain tests in parallel
nx run-many --target=test --projects=*-domain --parallel=3

# Application layer (with mocks)
nx test user-api-service --testPathPattern=use-case

# Integration tests (requires DynamoDB Local)
nx test user-domain --testPathPattern=integration

# E2E tests
nx e2e user-api-service-e2e
```

### By Type
```bash
# Unit tests only (exclude integration)
pnpm nx run-many --target=test --exclude=*-e2e

# Integration tests only
pnpm nx test user-domain --testPathPattern=integration

# All tests
pnpm nx run-many --target=test

# Watch mode for TDD
nx test user-domain --watch

# Coverage report
nx test user-domain --coverage
```

---

## 📊 Coverage Goals

| Layer | Coverage Goal | Test Count |
|-------|--------------|------------|
| **Domain packages** | 80% | 70% of tests |
| **Service apps** | 70% | 20% of tests |
| **Frontend apps** | 70% | 5% of tests |
| **Shared packages** | 70% | 5% of tests |
| **E2E projects** | No threshold | Complement unit/integration tests |

**Why Domain has highest coverage?**
- Pure business logic = easy to test
- No external dependencies = deterministic
- Critical business rules = must be protected

---

## ✅ What Each Layer Tests

### Domain Layer Tests
```typescript
✅ User.create() validates email format
✅ User.verifyEmail() throws if already verified
✅ User.activate() requires verified email
✅ Order.addItem() validates quantity > 0
✅ Order.confirmOrder() requires payment
✅ Product.decreaseInventory() checks availability
✅ Product.updateInventory() auto-transitions status
```

### Application Layer Tests
```typescript
✅ CreateUserUseCase checks email doesn't exist
✅ CreateUserUseCase calls repository.save()
✅ CreateOrderUseCase validates customer exists
✅ CreateOrderUseCase publishes OrderCreated event
✅ ConfirmOrderUseCase loads order aggregate
✅ Use case handles repository errors
```

### Infrastructure Layer Tests
```typescript
✅ Repository saves and retrieves entities
✅ GSI queries return correct results
✅ toDomain/toPersistence preserve all fields
✅ Batch operations work correctly
✅ Pagination cursors work
```

### Presentation Layer Tests
```typescript
✅ POST /users returns 201 with valid data
✅ POST /users returns 400 for invalid email
✅ POST /users returns 409 for duplicate email
✅ GET /users/:id returns 404 for non-existent
✅ Authentication middleware blocks unauthorized
```

---

## 🎯 Testing Best Practices

### 1. **AAA Pattern (Arrange, Act, Assert)**
```typescript
it('should activate user', () => {
  // Arrange - Setup test data
  const user = User.create({...});
  user.verifyEmail();

  // Act - Execute the behavior
  user.activate();

  // Assert - Verify the outcome
  expect(user.isActive()).toBe(true);
});
```

### 2. **Test One Thing Per Test**
```typescript
// ❌ Bad - tests multiple things
it('should create and activate user', () => {
  const user = User.create({...});
  user.verifyEmail();
  user.activate();
  expect(user.isActive()).toBe(true);
});

// ✅ Good - separate tests
it('should create user with pending status', () => {
  const user = User.create({...});
  expect(user.getUserStatus()).toBe('PENDING');
});

it('should activate user after email verification', () => {
  const user = User.create({...});
  user.verifyEmail();
  user.activate();
  expect(user.isActive()).toBe(true);
});
```

### 3. **Test Edge Cases and Errors**
```typescript
it('should throw error for zero quantity', () => {
  expect(() => {
    OrderItem.create({ quantity: 0, ... });
  }).toThrow('Quantity must be greater than 0');
});

it('should throw error when decreasing inventory below zero', () => {
  const product = Product.create({ inventory: 5, ... });
  expect(() => {
    product.decreaseInventory(10);
  }).toThrow('Insufficient inventory');
});
```

### 4. **Use Descriptive Test Names**
```typescript
// ❌ Bad
it('test1', () => { ... });

// ✅ Good
it('should throw error when activating user without verified email', () => { ... });
```

### 5. **Keep Tests Independent**
```typescript
// ❌ Bad - tests depend on order
let sharedUser;
it('test1', () => { sharedUser = User.create({...}); });
it('test2', () => { sharedUser.activate(); });

// ✅ Good - each test is independent
it('test1', () => {
  const user = User.create({...});
  // test...
});
it('test2', () => {
  const user = User.create({...});
  // test...
});
```

---

## 🔧 CI/CD Pipeline

The CI pipeline runs tests in stages:

1. **Fast checks** (lint, typecheck) — `ci-fast-check.yml`
2. **Unit tests per domain** — `ci-test-affected.yml` (only affected projects)
3. **Integration tests** — run against LocalStack + Postgres service containers
4. **API E2E tests** — `ci-e2e.yml`, job `api-e2e-tests` — full HTTP tests against running backend services
5. **Webapp E2E tests** — `ci-e2e.yml`, job `webapp-e2e-tests` — Playwright browser tests (runs after API E2E passes)

All workflows use Node 24, pnpm 10, and LocalStack with `SERVICES=dynamodb,sqs`. Prisma domains also spin up a Postgres 16 service container.

See `.github/workflows/` for full workflow definitions.

---

## 📝 Summary

**Testing Pyramid for This Project:**

1. **Domain Layer (70%)** - Unit tests, no mocks, pure logic
   - Fast, reliable, easy to write
   - Protects core business rules
   - Run on every commit

2. **Application Layer (20%)** - Unit tests with mocked repositories
   - Tests orchestration logic
   - Verifies correct repository calls
   - Tests workflows

3. **Infrastructure (5%)** - Integration tests against real DB
   - Slower, requires setup
   - Tests actual persistence
   - Run before merge/deploy

4. **API E2E (2.5%)** - Full HTTP request/response cycle (Jest + axios)
   - Tests against running backend services with real infrastructure
   - Validates CRUD, status transitions, cross-domain interactions, pagination
   - Data isolation via dedicated E2E tables/databases/queues
   - Run via `pnpm nx e2e {service}-e2e`

5. **Webapp E2E (2.5%)** - Browser automation (Playwright)
   - Tests critical user flows end-to-end
   - Page objects + data-testid selectors
   - Data seeded via API calls, not direct DB
   - Run via `pnpm nx e2e webapp-e2e`

**Key Principle:** Write most tests where the logic lives (Domain Layer)!

---

## 🧪 E2E Testing

### Data Isolation

E2E tests use **dedicated infrastructure** to avoid polluting development data:

| Resource | Dev value | E2E value |
|---|---|---|
| DynamoDB tables | `OldSTTable` | `OldSTTable_E2E_Users`, `OldSTTable_E2E_Products` |
| Postgres database | `orders_db` | `orders_e2e_db` |
| SQS queues | `user-events`, `order-events` | `user-events-e2e`, `order-events-e2e` |

E2E env vars are defined in `.env.e2e.example`. Scripts: `scripts/setup-e2e.ts` (create) and `scripts/teardown-e2e.ts` (destroy).

### Project Structure

| Project | Type | Location |
|---|---|---|
| `{domain}-api-service-e2e` | API E2E (Jest) | `apps/{domain}/{domain}-api-service-e2e/` |
| `webapp-e2e` | Browser E2E (Playwright) | `apps/webapp-e2e/` |

> **Reference implementation:** see [examples/apps/](examples/apps/) for working `user-api-service-e2e`, `product-api-service-e2e`, and `order-api-service-e2e` projects.

### Running E2E Tests

```bash
# Prerequisites: infrastructure running + services started
pnpm run e2e:setup          # Create E2E tables/databases/queues

# API E2E (one per service)
pnpm nx e2e user-api-service-e2e
pnpm nx e2e product-api-service-e2e
pnpm nx e2e order-api-service-e2e

# Webapp E2E (Playwright)
pnpm nx e2e webapp-e2e
```

### When to Write E2E Tests

- Adding a new API service → add a `{service}-e2e` project
- Adding critical endpoints → add API E2E specs for CRUD + status transitions
- Adding a new webapp domain page → add Playwright specs
- Changing cross-domain interactions → add E2E specs that verify the integration

### Claude Code Skills for E2E

| Skill | Purpose |
|---|---|
| `write-api-e2e-tests` | Write API E2E tests for a backend service |
| `write-webapp-e2e-tests` | Write Playwright E2E tests for the webapp |
| `e2e-infrastructure` | Add E2E infrastructure for a new domain |
