---
name: new-use-case
description: Add a new use case to an existing domain package. Use this when implementing a specific domain operation such as create, get, update, delete, activate, deactivate, or any other workflow on a domain entity. Each use case has a single responsibility.
---

# Adding a New Use Case

---

## File Location

```
packages/{domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.ts
packages/{domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.spec.ts
```

---

## Directory Naming

| Operation | Directory |
|---|---|
| Create | `create-{entity}/` |
| Get by ID | `get-{entity}-by-id/` |
| Get by email | `get-{entity}-by-email/` |
| Update profile | `update-{entity}-profile/` |
| Delete | `delete-{entity}/` |
| Activate | `activate-{entity}/` |
| Deactivate | `deactivate-{entity}/` |
| List by status | `list-{entities}-by-status/` |
| List by role+status | `list-{entities}-by-role-and-status/` |

---

## Use Case Template

```typescript
import { IUseCase } from '@old-st/common';
import { I{Entity}Repository } from '../../interfaces/{entity}-repository.interface';
import { {Entity} } from '../../../domain/entities';
import { {ApplicationException} } from '../../exceptions';

export interface {Verb}{Entity}Input {
  // Primitive types only — no DTOs, no Zod types, no @old-st/contracts imports
  {entity}Id?: string;
  field1?: string;
}

export class {Verb}{Entity}UseCase implements IUseCase<{Verb}{Entity}Input, {Entity}> {
  constructor(private readonly {entity}Repository: I{Entity}Repository) {}

  async execute(input: {Verb}{Entity}Input): Promise<{Entity}> {
    // 1. Load entity from repository (if needed)
    // 2. Call entity business method(s) (entity throws domain exceptions if violated)
    // 3. Persist via repository (if mutations occurred)
    // 4. Return the entity
  }
}
```

---

## Patterns for Each Use Case Type

### Create

```typescript
async execute(input: Create{Entity}Input): Promise<{Entity}> {
  // 1. Check uniqueness if required — entity cannot do this itself
  const existing = await this.{entity}Repository.findByEmail(input.email);
  if (existing) {
    throw new {Entity}EmailAlreadyExistsError(input.email);
  }

  // 2. Create domain entity — field invariants enforced in {Entity}.create()
  const entity = {Entity}.create({
    field1: input.field1,
    field2: input.field2,
  });

  // 3. Persist and return
  return await this.{entity}Repository.save(entity);
}
```

### Get by ID (throws if not found)

```typescript
async execute(id: string): Promise<{Entity}> {
  const entity = await this.{entity}Repository.findById(id);
  if (!entity) {
    throw new {Entity}NotFoundError(id);
  }
  return entity;
}
```

### Update (fetch → mutate via entity method → save)

```typescript
async execute(input: Update{Entity}Input): Promise<{Entity}> {
  const entity = await this.{entity}Repository.findById(input.{entity}Id);
  if (!entity) {
    throw new {Entity}NotFoundError(input.{entity}Id);
  }
  // Entity method enforces business guards — throws typed domain exception if violated
  entity.updateProfile({ field1: input.field1, field2: input.field2 });
  return await this.{entity}Repository.save(entity);
}
```

### State Transition (fetch → call business method → save)

```typescript
async execute(id: string): Promise<{Entity}> {
  const entity = await this.{entity}Repository.findById(id);
  if (!entity) {
    throw new {Entity}NotFoundError(id);
  }
  // Domain exception thrown here if business rules are violated — let it propagate
  entity.activate();
  return await this.{entity}Repository.save(entity);
}
```

### Delete (soft delete, returns void)

```typescript
async execute(id: string): Promise<void> {
  const entity = await this.{entity}Repository.findById(id);
  if (!entity) {
    throw new {Entity}NotFoundError(id);
  }
  entity.delete();
  await this.{entity}Repository.save(entity);
}
```

### List with Pagination

#### DynamoDB domains (cursor-based)

```typescript
async execute(input: List{Entities}ByStatusInput): Promise<IPaginatedResponse<{Entity}>> {
  return await this.{entity}Repository.listByStatus(
    input.{entity}Status,
    input.limit,
    input.direction,
    input.direction === 'next' ? input.cursor : undefined,
    input.direction === 'prev' ? input.cursor : undefined,
  );
}
```

#### Prisma domains (offset-based)

```typescript
export interface List{Entities}ByStatusInput {
  status: string;
  page?: number;
  limit?: number;
}

async execute(input: List{Entities}ByStatusInput): Promise<IOffsetPaginatedResponse<{Entity}>> {
  return await this.{entity}Repository.findByStatus(
    input.status,
    input.page,
    input.limit,
  );
}
```

> **Note:** The use case must not import Prisma types — only the repository interface (`IOffsetPaginatedResponse` comes from `@old-st/common`).

---

## Rules

1. Use cases implement `IUseCase<Input, Output>` from `@old-st/common`.
2. Throw **typed application exceptions** (from `application/exceptions/`) for "not found" and invalid input.
3. Domain exceptions thrown by entity methods **propagate naturally** — do NOT catch and re-wrap them.
4. Use cases **never import from `@old-st/contracts`** — DTO transformation is the application service's job.
5. Use cases return the **domain entity** — never a DTO.
6. Never call more than one `save()` per use case. If you need a transaction, reconsider the design.
7. When the use case needs to validate an entity from another bounded context (e.g. check that a customer exists before creating an order), inject an **ACL interface** alongside the repository — see "Use Case with ACL Dependency" below. Follow the `sync-cross-service-call` skill for defining the interface and adapter.

---

## Use Case with ACL Dependency (Cross-Service Validation)

When a use case needs real-time validation against another bounded context, it receives an **ACL validator interface** as a second constructor dependency — alongside the repository.

```typescript
import { IUseCase } from '@old-st/common';
import { I{Entity}Repository } from '../../interfaces/{entity}-repository.interface';
import { I{UpstreamEntity}Validator } from '../../interfaces/{upstream-entity}-validator.interface';
import { {Entity} } from '../../../domain/entities';

export interface Create{Entity}Input {
  {upstreamEntity}Id: string; // must be validated against upstream service
  field1: string;
}

export class Create{Entity}UseCase implements IUseCase<Create{Entity}Input, {Entity}> {
  constructor(
    private readonly {entity}Repository: I{Entity}Repository,
    private readonly {upstreamEntity}Validator: I{UpstreamEntity}Validator,
  ) {}

  async execute(input: Create{Entity}Input): Promise<{Entity}> {
    // 1. Validate upstream entity FIRST (throws if invalid/not found/unavailable)
    await this.{upstreamEntity}Validator.validate(input.{upstreamEntity}Id);

    // 2. Proceed with domain logic
    const entity = {Entity}.create({ ...input });
    return await this.{entity}Repository.save(entity);
  }
}
```

**Rules for ACL-dependent use cases:**
- ACL validation happens **before** any domain state mutation.
- The use case does NOT catch ACL exceptions — they propagate to the exception filter.
- The ACL interface is defined in the consuming domain's `application/interfaces/` — see the `sync-cross-service-call` skill for the complete interface template.
- The ACL adapter (HTTP client) lives in the service's `infrastructure/clients/` — never in the domain package.

---

## Aggregate Use Case Patterns

When a use case operates on an aggregate root (entity with child entities), the pattern is:
load aggregate → call root's business method → save aggregate.

### Adding a Child to the Aggregate

```typescript
export interface Add{Child}Input {
  {root}Id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export class Add{Child}UseCase implements IUseCase<Add{Child}Input, {Root}> {
  constructor(private readonly {root}Repository: I{Root}Repository) {}

  async execute(input: Add{Child}Input): Promise<{Root}> {
    const root = await this.{root}Repository.findById(input.{root}Id);
    if (!root) throw new {Root}NotFoundError(input.{root}Id);

    // Create the child entity
    const child = {Child}.create({
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      price: input.price,
    });

    // Root's business method handles all guard logic + recalculation
    root.addItem(child);

    return await this.{root}Repository.save(root);
  }
}
```

### State Transition on the Aggregate

```typescript
export class Confirm{Root}UseCase implements IUseCase<string, {Root}> {
  constructor(
    private readonly {root}Repository: I{Root}Repository,
    private readonly {upstream}Validator: I{Upstream}Validator,  // optional ACL
  ) {}

  async execute({root}Id: string): Promise<{Root}> {
    // Validate upstream entity if ACL is present
    const root = await this.{root}Repository.findById({root}Id);
    if (!root) throw new {Root}NotFoundError({root}Id);

    await this.{upstream}Validator.validate(root.getOwnerId());

    // Root's confirm() enforces all cross-entity invariants:
    // - items not empty
    // - payment present and amount matches total
    // - no price drift on any item
    root.confirm();

    return await this.{root}Repository.save(root);
  }
}
```

**Rules for aggregate use cases:**
- Always load the full aggregate via `findById()` — the repository handles loading children.
- Call the root's business methods — never modify children directly in the use case.
- The repository's `save()` handles persisting root + all children (replace-children strategy).
- One `save()` call per use case — the aggregate is the transactional boundary.

---

## Input Type Rules

- Define `{Verb}{Entity}Input` as an interface in the same use case file.
- Use domain types (`{Entity}Status`, `{Entity}Role`) not raw string types.
- Optional fields use `?: string` — not Zod union types.
- Never import from `@old-st/contracts` in a use case.

---

## Barrel Updates (Required After Every New Use Case)

`src/application/use-cases/index.ts`:
```typescript
export * from './create-{entity}/create-{entity}.use-case';
export * from './get-{entity}-by-id/get-{entity}-by-id.use-case';
// add each new use case here
```

`src/application/index.ts` must export:
```typescript
export * from './use-cases';
export * from './interfaces';
export * from './exceptions';
```

`src/index.ts` must export:
```typescript
export * from './application';
export * from './domain';
```
