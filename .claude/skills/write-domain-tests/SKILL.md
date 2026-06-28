---
name: write-domain-tests
description: Write unit tests for domain entities, use cases, and application services. Use this when adding tests for new or existing domain logic, following the Jest + mock repository patterns used in this codebase.
---

# Writing Domain Tests

Tests are co-located with their source files (`.spec.ts` next to `.ts`).

---

## What Gets Tested and Where

| Layer | Test file location | What to test |
|---|---|---|
| Domain entity | `src/domain/entities/{entity}.entity.spec.ts` | `create()`, `reconstitute()`, every business method, every invariant |
| Use case | `src/application/use-cases/{op}/{op}.use-case.spec.ts` | Success path, not-found path, already-exists path |
| Application service | `src/application/services/...spec.ts` | Only if orchestration logic exists beyond simple delegation |

Infrastructure repositories are tested via integration tests (separate `jest.integration.config.ts`), not unit tests.

---

## Mock Repository Pattern

Use a plain mock object cast with `as unknown as I{Entity}Repository`. This avoids implementing all abstract methods.

```typescript
import { I{Entity}Repository } from '../../interfaces/{entity}-repository.interface';
import { {Entity} } from '../../../domain/entities/{entity}.entity';

function createMockRepository(overrides: Partial<I{Entity}Repository> = {}) {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByStatus: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as I{Entity}Repository;
}
```

### Mocking Paginated Responses

**DynamoDB domains** (cursor-based):
```typescript
const paginatedResult = {
  data: [],
  nextCursorPointer: null,
  prevCursorPointer: null,
};
mockRepo.findByStatus.mockResolvedValue(paginatedResult);
```

**Prisma domains** (offset-based):
```typescript
const paginatedResult = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};
mockRepo.findByStatus.mockResolvedValue(paginatedResult);
```

Reset mocks between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## Entity Unit Tests

Test file: `packages/{domain}-domain/src/domain/entities/{entity}.entity.spec.ts`

```typescript
import { {Entity} } from './{entity}.entity';
import { {Entity}StatusEnum, {Entity}RoleEnum } from '../constants/{entity}.constants';
import { {Entity}NotFoundError, {Entity}AlreadyActiveError } from '../exceptions';

describe('{Entity}', () => {

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a valid entity with generated id', () => {
      const entity = {Entity}.create({
        email: 'test@example.com',
        name: 'Test User',
        role: {Entity}RoleEnum.USER,
      });

      expect(entity.getEmail()).toBe('test@example.com');
      expect(entity.getName()).toBe('Test User');
      expect(entity.get{Entity}Id()).toBeDefined();
      expect(entity.getStatus()).toBe({Entity}StatusEnum.PENDING);  // default status
    });

    it('should throw when required field is missing', () => {
      expect(() =>
        {Entity}.create({ email: '', name: 'Test', role: {Entity}RoleEnum.USER })
      ).toThrow();  // domain exception or validation error
    });
  });

  // ── reconstitute() ──────────────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('should restore entity without applying create() validators', () => {
      // reconstitute() must not throw even for states that create() would reject
      const entity = {Entity}.reconstitute({
        {entity}Id: 'existing-id',
        email: 'old@example.com',
        name: 'Old Name',
        role: {Entity}RoleEnum.USER,
        status: {Entity}StatusEnum.SUSPENDED,  // create() might not allow this directly
        dateCreated: new Date('2020-01-01').toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(entity.get{Entity}Id()).toBe('existing-id');
      expect(entity.getStatus()).toBe({Entity}StatusEnum.SUSPENDED);
    });
  });

  // ── Business methods ─────────────────────────────────────────────────────────

  describe('activate()', () => {
    it('should activate a PENDING entity', () => {
      const entity = {Entity}.create({ email: 'a@b.com', name: 'A', role: {Entity}RoleEnum.USER });
      entity.activate();
      expect(entity.getStatus()).toBe({Entity}StatusEnum.ACTIVE);
    });

    it('should throw when already ACTIVE', () => {
      const entity = {Entity}.reconstitute({
        {entity}Id: 'id-1',
        email: 'a@b.com',
        name: 'A',
        role: {Entity}RoleEnum.USER,
        status: {Entity}StatusEnum.ACTIVE,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(() => entity.activate()).toThrow({Entity}AlreadyActiveError);
    });
  });
});
```

**Entity test checklist:**
- [ ] `create()` happy path — verify all default values
- [ ] `create()` validation — invalid input throws expected error
- [ ] `reconstitute()` — restores all fields, does NOT run `create()` validators
- [ ] Each business method — happy path transitions state correctly
- [ ] Each business method — every guard condition throws the right exception

---

## Use Case Unit Tests

Test file: `packages/{domain}-domain/src/application/use-cases/{op}/{op}.use-case.spec.ts`

```typescript
import { Create{Entity}UseCase } from './create-{entity}.use-case';
import { {Entity}AlreadyExistsError } from '../../../domain/exceptions';
import { createMockRepository } from '../../../test-utils/mock-repository';  // or inline

describe('Create{Entity}UseCase', () => {
  let useCase: Create{Entity}UseCase;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    useCase  = new Create{Entity}UseCase(mockRepo);
  });

  it('should create and persist the entity', async () => {
    mockRepo.findByEmail = jest.fn().mockResolvedValue(null);  // no duplicate
    mockRepo.save        = jest.fn().mockImplementation((e) => Promise.resolve(e));

    const result = await useCase.execute({
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
    });

    expect(result.getEmail()).toBe('test@example.com');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw {Entity}AlreadyExistsError when email is taken', async () => {
    mockRepo.findByEmail = jest.fn().mockResolvedValue({} as any);  // existing record

    await expect(
      useCase.execute({ email: 'taken@example.com', name: 'Test', role: 'USER' })
    ).rejects.toThrow({Entity}AlreadyExistsError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
```

**Use case test checklist:**
- [ ] Success path — entity created, `save()` called once, return value is correct
- [ ] Not-found path (for update/delete/state uses) — throws `{Entity}NotFoundError`
- [ ] Duplicate/conflict path — throws `{Entity}AlreadyExistsError`
- [ ] State guard — throws transition error when the entity is in the wrong state
- [ ] `save()` is NOT called when the use case throws early

---

## State Transition Use Case Tests

```typescript
describe('Activate{Entity}UseCase', () => {
  it('should activate when PENDING', async () => {
    const pendingEntity = {Entity}.reconstitute({ ..., status: {Entity}StatusEnum.PENDING });
    mockRepo.findById = jest.fn().mockResolvedValue(pendingEntity);
    mockRepo.save     = jest.fn().mockImplementation((e) => Promise.resolve(e));

    const result = await useCase.execute({ {entity}Id: 'id-1' });

    expect(result.getStatus()).toBe({Entity}StatusEnum.ACTIVE);
    expect(mockRepo.save).toHaveBeenCalledWith(pendingEntity);
  });

  it('should throw when entity not found', async () => {
    mockRepo.findById = jest.fn().mockResolvedValue(null);

    await expect(useCase.execute({ {entity}Id: 'missing' }))
      .rejects.toThrow({Entity}NotFoundError);
  });

  it('should throw when already ACTIVE', async () => {
    const activeEntity = {Entity}.reconstitute({ ..., status: {Entity}StatusEnum.ACTIVE });
    mockRepo.findById = jest.fn().mockResolvedValue(activeEntity);

    await expect(useCase.execute({ {entity}Id: 'id-1' }))
      .rejects.toThrow({Entity}AlreadyActiveError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
```

---

## Running Tests

```bash
# Run all tests for a specific domain package
npx nx test {domain}-domain

# Run with coverage
npx nx test {domain}-domain --coverage

# Skip cache for reliability checks
npx nx test {domain}-domain --skip-nx-cache

# Run a single spec file
npx nx test {domain}-domain --testFile=src/domain/entities/{entity}.entity.spec.ts
```

---

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Testing `reconstitute()` with invalid arguments expecting a throw | `reconstitute()` does NOT validate — only `create()` does |
| Mocking the entity itself | Never mock entities — instantiate them with `create()` or `reconstitute()` |
| `expect(fn).toThrow(ErrorClass)` on async functions | Use `await expect(fn()).rejects.toThrow(ErrorClass)` |
| Asserting `mockRepo.save` was called without checking the right entity | Use `toHaveBeenCalledWith(expectedEntity)` where possible |
| Checking the exact mock call on `findById` after it throws | If the use case throws early, `save` should NOT have been called — assert that too |

---

## ACL Mock Pattern (Cross-Service Validation)

When a use case injects an ACL validator (e.g. `ICustomerValidator`), mock it alongside the repository.

```typescript
import { I{Upstream}Validator } from '../../interfaces/{upstream}-validator.interface';

function createMock{Upstream}Validator(
  overrides: Partial<I{Upstream}Validator> = {},
): I{Upstream}Validator {
  return {
    validate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as I{Upstream}Validator;
}
```

### Use Case Test with ACL Dependency

```typescript
describe('Create{Entity}UseCase', () => {
  let useCase: Create{Entity}UseCase;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockValidator: I{Upstream}Validator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    mockValidator = createMock{Upstream}Validator();
    // Pass validator as second constructor arg — matches the use case signature
    useCase = new Create{Entity}UseCase(mockRepo, mockValidator);
  });

  it('should validate upstream entity before creating', async () => {
    mockRepo.save = jest.fn().mockImplementation((e) => Promise.resolve(e));

    await useCase.execute({ upstreamId: 'upstream-1', field1: 'value' });

    expect(mockValidator.validate).toHaveBeenCalledWith('upstream-1');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw when upstream validation fails', async () => {
    mockValidator.validate = jest.fn().mockRejectedValue(
      new {Upstream}NotFoundError('upstream-1'),
    );

    await expect(
      useCase.execute({ upstreamId: 'upstream-1', field1: 'value' }),
    ).rejects.toThrow({Upstream}NotFoundError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
```

**Rules:**
- Mock the validator's `validate()` method to resolve `undefined` for the happy path.
- ACL failure tests: mock `validate()` to reject with the domain-specific ACL exception.
- The validator is always the **second** constructor arg (after the repository).

---

## Aggregate Entity Tests

When testing an aggregate root with child entities, additional patterns are needed.

### Reconstituting with Nullable/Optional Child Fields

Child entities may have nullable fields (e.g. `latestKnownPrice`). Always include these in reconstitute test data:

```typescript
describe('reconstitute()', () => {
  it('should reconstitute child entities with nullable fields', () => {
    const item = {Child}.reconstitute({
      childId: 'item-1',
      productId: 'prod-1',
      productName: 'Widget',
      quantity: 2,
      price: 10.00,
      latestKnownPrice: null,        // ← nullable field must be explicitly tested
      dateCreated: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(item.getLatestKnownPrice()).toBeNull();
  });

  it('should reconstitute child entities with populated nullable fields', () => {
    const item = {Child}.reconstitute({
      childId: 'item-1',
      productId: 'prod-1',
      productName: 'Widget',
      quantity: 2,
      price: 10.00,
      latestKnownPrice: 12.00,       // ← non-null variant
      dateCreated: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(item.getLatestKnownPrice()).toBe(12.00);
  });
});
```

### Cross-Entity Invariant Tests

Test that the aggregate root enforces invariants across its children:

```typescript
describe('confirm()', () => {
  it('should throw when payment amount does not match total', () => {
    const root = createDraftRootWithItems(/* totalAmount: 30 */);
    const badPayment = {Payment}.create({ method: 'CREDIT_CARD', amount: 25 }); // wrong amount
    expect(() => root.addPayment(badPayment)).toThrow(PaymentAmountMismatchError);
  });

  it('should throw when items have price drift', () => {
    const root = createDraftRootWithItems();
    // Simulate price drift on a child item
    const item = root.getItems()[0];
    // ... set up item with latestKnownPrice !== price
    root.addPayment(validPayment);
    expect(() => root.confirmOrder()).toThrow(PriceDriftDetectedError);
  });

  it('should throw when no items', () => {
    const emptyRoot = {Root}.create({ ownerId: 'owner-1' });
    expect(() => emptyRoot.confirm()).toThrow(CannotConfirmEmptyError);
  });
});
```

---

## Application Service Tests

Application services live in the service app (e.g. `apps/{domain}/{service}/src/application/services/`).
They orchestrate use cases and transform domain entities to DTOs via Zod `schema.parse()`.

Test file: `apps/{domain}/{service}/src/application/services/{entity}-application.service.spec.ts`

### Mock Dependencies

Mock use cases as `{ execute: jest.fn() }` cast to `any`. Mock Zod schemas as pass-through parsers.
When the service injects an `IEventPublisher`, mock it with `{ publish: jest.fn() }`.

```typescript
import { {Entity}ApplicationService } from './{entity}-application.service';

// Mock contracts schemas — pass-through
jest.mock('@mma/contracts/{domain}', () => ({
  ...(jest.requireActual('@mma/contracts/{domain}') as object),
  {entity}ResponseSchema: { parse: jest.fn((input: unknown) => input) },
  paginatedResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

describe('{Entity}ApplicationService', () => {
  const mockCreateUseCase = { execute: jest.fn() };
  const mockGetByIdUseCase = { execute: jest.fn() };
  const mockListByStatusUseCase = { execute: jest.fn() };
  const mockDeleteUseCase = { execute: jest.fn() };
  const mockEventPublisher = { publish: jest.fn() };
  let service: {Entity}ApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new {Entity}ApplicationService(
      mockCreateUseCase as any,
      mockGetByIdUseCase as any,
      mockListByStatusUseCase as any,
      mockDeleteUseCase as any,
      mockEventPublisher as any,
    );
  });

  describe('create{Entity}()', () => {
    it('should delegate to use case and return parsed DTO', async () => {
      const mockEntity = { getId: () => 'id-1', getEmail: () => 'test@test.com' };
      mockCreateUseCase.execute.mockResolvedValue(mockEntity);

      const result = await service.create{Entity}({ email: 'test@test.com' });

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(result).toBeDefined();
    });
  });

  describe('delete{Entity}()', () => {
    it('should delegate to delete use case and publish event', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await service.delete{Entity}('id-1');

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({ {entity}Id: 'id-1' });
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });
});
```

### Cursor Routing (DynamoDB Domains)

Test that `direction` is routed to `nextCursorPointer` or `prevCursorPointer`:

```typescript
describe('listByStatus() cursor routing', () => {
  it('should pass cursor as nextCursorPointer when direction is next', async () => {
    mockListByStatusUseCase.execute.mockResolvedValue({
      data: [], nextCursorPointer: null, prevCursorPointer: null,
    });

    await service.listByStatus({ status: 'ACTIVE', cursor: 'abc', direction: 'next' });

    expect(mockListByStatusUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ nextCursorPointer: 'abc', prevCursorPointer: undefined }),
    );
  });

  it('should pass cursor as prevCursorPointer when direction is prev', async () => {
    mockListByStatusUseCase.execute.mockResolvedValue({
      data: [], nextCursorPointer: null, prevCursorPointer: null,
    });

    await service.listByStatus({ status: 'ACTIVE', cursor: 'abc', direction: 'prev' });

    expect(mockListByStatusUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ nextCursorPointer: undefined, prevCursorPointer: 'abc' }),
    );
  });
});
```

---

## Event Handler Service Tests

Event handler services live in `apps/{domain}/{event-service}/src/application/services/`.
They parse SQS records via Zod `safeParse()` and dispatch to handler functions by event type.

Test file: `apps/{domain}/{event-service}/src/application/services/{domain}-event-handler.service.spec.ts`

### Dispatcher Pattern

Mock the handler functions as jest functions, inject them, and test dispatch logic:

```typescript
import { {Domain}EventHandlerService } from './{domain}-event-handler.service';

describe('{Domain}EventHandlerService', () => {
  const mockUseCaseA = { execute: jest.fn() };
  const mockUseCaseB = { execute: jest.fn() };
  let service: {Domain}EventHandlerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new {Domain}EventHandlerService(
      mockUseCaseA as any,
      mockUseCaseB as any,
    );
  });

  it('should dispatch EVENT_A to useCaseA', async () => {
    const record = {
      body: JSON.stringify({ eventType: 'EVENT_A', payload: { id: '1' } }),
      messageId: 'msg-1',
    };

    await service.handleRecord(record as any);

    expect(mockUseCaseA.execute).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('should log warning for unknown event types', async () => {
    const record = {
      body: JSON.stringify({ eventType: 'UNKNOWN_EVENT', payload: {} }),
      messageId: 'msg-2',
    };

    // Should not throw
    await service.handleRecord(record as any);

    expect(mockUseCaseA.execute).not.toHaveBeenCalled();
    expect(mockUseCaseB.execute).not.toHaveBeenCalled();
  });

  it('should skip records with invalid JSON body', async () => {
    const record = { body: 'not-json', messageId: 'msg-3' };

    await service.handleRecord(record as any);

    expect(mockUseCaseA.execute).not.toHaveBeenCalled();
  });
});
```

### Individual Handler Tests

Each handler is tested in isolation with its own spec file:

```typescript
// handlers/{event-name}.handler.spec.ts

describe('handle{EventName}', () => {
  const mockUseCase = { execute: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('should delegate to use case with correct payload', async () => {
    await handle{EventName}({ entityId: 'id-1' }, mockUseCase as any);

    expect(mockUseCase.execute).toHaveBeenCalledWith({ entityId: 'id-1' });
  });

  it('should propagate use case errors', async () => {
    mockUseCase.execute.mockRejectedValue(new Error('unexpected'));

    await expect(handle{EventName}({ entityId: 'id-1' }, mockUseCase as any))
      .rejects.toThrow('unexpected');
  });
});
```

### Idempotency Guard Tests

For saga-resolution handlers, test that specific domain errors are swallowed:

```typescript
describe('handle{SagaEvent} idempotency', () => {
  it('should swallow {IdempotentError} (already processed)', async () => {
    const idempotentError = new Error('Already processed');
    idempotentError.name = '{IdempotentErrorName}';
    mockUseCase.execute.mockRejectedValue(idempotentError);

    // Should NOT throw
    await handle{SagaEvent}({ entityId: 'id-1' }, mockUseCase as any);
  });

  it('should rethrow non-idempotent errors', async () => {
    mockUseCase.execute.mockRejectedValue(new Error('unexpected'));

    await expect(handle{SagaEvent}({ entityId: 'id-1' }, mockUseCase as any))
      .rejects.toThrow('unexpected');
  });
});
```

---

## ACL Client Tests

ACL adapters live in `apps/{domain}/{service}/src/infrastructure/clients/`.
They use NestJS `HttpService` (rxjs) to call upstream services.

Test file: `apps/{domain}/{service}/src/infrastructure/clients/{upstream}-api.client.spec.ts`

```typescript
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { {Upstream}ApiClient } from './{upstream}-api.client';

describe('{Upstream}ApiClient', () => {
  let httpService: { get: jest.Mock };
  let client: {Upstream}ApiClient;

  beforeEach(() => {
    httpService = { get: jest.fn() };
    client = new {Upstream}ApiClient(httpService as unknown as HttpService);
    // Set the base URL
    (client as any).baseUrl = 'http://localhost:3000/api';
  });

  it('should resolve when upstream returns ACTIVE entity', async () => {
    const response = { data: { entityId: 'id-1', status: 'ACTIVE' } };
    httpService.get.mockReturnValue(of(response as AxiosResponse));

    await expect(client.validate('id-1')).resolves.toBeUndefined();
  });

  it('should throw domain error when upstream returns 404', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 404 },
    } as AxiosError;
    httpService.get.mockReturnValue(throwError(() => axiosError));

    await expect(client.validate('id-1'))
      .rejects.toThrow({Entity}NotFoundError);
  });

  it('should throw ServiceUnavailableError on 5xx', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 500 },
    } as AxiosError;
    httpService.get.mockReturnValue(throwError(() => axiosError));

    await expect(client.validate('id-1'))
      .rejects.toThrow(ServiceUnavailableError);
  });
});
```

**ACL test checklist:**
- [ ] Happy path — upstream returns valid entity → resolves
- [ ] 404 → throws domain not-found error
- [ ] 409 → throws domain invalid-state error
- [ ] 5xx → throws service-unavailable error
- [ ] Non-Axios errors → throws service-unavailable error
- [ ] Domain errors are re-thrown directly

### Helper Factory for Aggregate Tests

Create a test helper that builds a fully-populated aggregate for reuse:

```typescript
function createDraftRootWithItems(overrides?: Partial<{Root}Props>): {Root} {
  const root = {Root}.create({ ownerId: 'owner-1', ...overrides });
  const item = {Child}.create({
    productId: 'prod-1',
    productName: 'Widget',
    quantity: 2,
    price: 15.00,
  });
  root.addItem(item);
  return root;
}
```
