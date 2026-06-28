---
name: domain-business-rules
description: Define and implement business rules, invariants, state transitions, and guard conditions inside a domain entity. Use this when adding business logic to any entity in packages/{domain}-domain/src/domain/entities. Always ask the developer structured questions before writing any code.
---

# Implementing Domain Business Rules

Business rules live **exclusively in the domain entity**. Use cases orchestrate; entities enforce.

---

## Part 1 — Required Elicitation: Ask Before Writing Any Code

Before generating any business methods or exceptions, ask the developer ALL of the following. Do not assume any answers. Do not skip questions.

### Q1 — Valid States / Statuses
> "What are the possible states or statuses for this entity? List them all."

Example: `PENDING | ACTIVE | INACTIVE | DELETED`

### Q2 — Allowed State Transitions and Their Conditions
> "For each state transition, what conditions must be true? List every valid transition and what blocks it."

Example:
- `PENDING → ACTIVE`: requires `emailVerified = true`
- `ACTIVE → INACTIVE`: no conditions
- `* → DELETED`: no conditions (unless already deleted)
- `DELETED → *`: never allowed

### Q3 — Field-Level Invariants
> "Are there format or value rules on any fields that must always be enforced? (e.g. email format, non-empty name, positive price, max length)"

Example: email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, first name cannot be empty.

### Q4 — Immutable Fields After Creation
> "Which fields can never be changed after the entity is created?"

Example: `email`, `dateCreated`, `ownerId`

### Q5 — Uniqueness Rules
> "Which fields must be unique? Globally or within a scope?"

Example: `email` must be globally unique. Note: uniqueness is enforced at the **repository / use case level** not the entity — the entity does not have access to the repository.

### Q6 — Idempotency Guards
> "Are there cases where calling an action twice should throw an error rather than silently succeed?"

Example: calling `verifyEmail()` when already verified → throw. Calling `activate()` on already-active entity → throw.

### Q7 — Conditional Update Rules
> "Which fields can be updated? Under what conditions is an update blocked?"

Example: profile fields can only be updated when status is not `DELETED`.

---

After receiving all answers, produce a **state machine summary table** and confirm it with the developer before writing any code:

| From State | To State | Method | Conditions | Exception if Violated |
|---|---|---|---|---|
| PENDING | ACTIVE | `activate()` | `emailVerified = true` | `CannotActivateUnverifiedEmailError` |
| ACTIVE | INACTIVE | `deactivate()` | `status !== 'DELETED'` | `CannotDeactivateDeletedError` |
| * | DELETED | `delete()` | none | — |

Ask: "Does this table capture all your business rules correctly before I write the code?"

---

## Part 2 — Encoding Patterns

Once confirmed, encode answers using these exact patterns.

### 2.1 Field Invariants → Validate in `create()`, Throw Domain Exception

```typescript
static create(props: { email: string; firstName: string }): {Entity} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(props.email)) {
    throw new InvalidEmailFormatError();
  }
  if (props.firstName.trim().length === 0) {
    throw new InvalidNameError('First name');
  }
  // ... more invariants before constructing
  return new {Entity}(null, props.email, props.firstName.trim(), ...);
}
```

**Rules:**
- Validate every invariant **before** constructing the entity.
- Throw a named typed domain exception — never `new Error('message')`.
- Do NOT run any validation in `reconstitute()` — persisted data is always trusted.

### 2.2 State Transitions → Named Public Business Method

```typescript
// PENDING → ACTIVE, requires emailVerified
activate(): void {
  if (this.status !== 'PENDING') {
    throw new CannotActivateNonPendingEntityError();
  }
  if (!this.emailVerified) {
    throw new CannotActivateUnverifiedEmailError();
  }
  this.status = EntityStatusEnum.ACTIVE;
  this.updatedAt = new Date().toISOString();
}
```

**Rules:**
- Method name is a verb: `activate()`, `deactivate()`, `verifyEmail()`, `publish()`, `close()`
- ALL guard checks come first, before any mutation
- Use the domain `StatusEnum` constant — never hardcode string literals like `'ACTIVE'`
- After all guards pass, mutate `this.field` directly
- Always update `this.updatedAt = new Date().toISOString()` at the end of every mutating method
- Return `void` — the use case reads the entity via getters after the call

### 2.3 Idempotency Guard

```typescript
verifyEmail(): void {
  if (this.emailVerified) {
    throw new EmailAlreadyVerifiedError(); // maps to 409 in DomainExceptionFilter
  }
  this.emailVerified = true;
  this.updatedAt = new Date().toISOString();
}
```

### 2.4 Conditional Update Guard

```typescript
updateProfile(props: { firstName?: string; lastName?: string }): void {
  if (this.status === EntityStatusEnum.DELETED) {
    throw new CannotUpdateDeletedEntityError();
  }
  if (props.firstName !== undefined) {
    if (props.firstName.trim().length === 0) throw new InvalidNameError('First name');
    this.firstName = props.firstName.trim();
  }
  if (props.lastName !== undefined) {
    if (props.lastName.trim().length === 0) throw new InvalidNameError('Last name');
    this.lastName = props.lastName.trim();
  }
  this.updatedAt = new Date().toISOString();
}
```

### 2.5 Immutable Fields → `private readonly`

```typescript
private constructor(
  private readonly entityId: string | null,  // set by DB
  private readonly email: string,            // never changes after creation
  private readonly dateCreated: string,
  private status: EntityStatus,              // mutable
  ...
```

---

## 2.6 Domain Exception Files

Every exception gets its own file under `src/domain/exceptions/`:

```typescript
// cannot-activate-non-pending-{entity}.error.ts
export class CannotActivateNonPending{Entity}Error extends Error {
  constructor() {
    super('{Entity} can only be activated from PENDING status');
    this.name = 'CannotActivateNonPending{Entity}Error';
  }
}
```

Naming convention:
- Illegal transition: `Cannot{Action}{Reason}Error` — e.g. `CannotActivateNonPendingUserError`
- Already-in-state conflict: `{Entity}Already{State}Error` — e.g. `UserAlreadyDeletedError`
- Invalid field: `Invalid{Field}Error` — e.g. `InvalidEmailFormatError`

Every new exception must be added to:
1. `src/domain/exceptions/index.ts`
2. `src/index.ts` (via the barrel chain)
3. The `DOMAIN_ERROR_MAP` in the service's `DomainExceptionFilter` — see `domain-exception-filter` skill

---

## What Belongs Where

| Concern | Entity | Use Case |
|---|---|---|
| Field format validation | YES | NO |
| State transition guards | YES | NO |
| Idempotency checks | YES | NO |
| Uniqueness check (e.g. email taken) | NO | YES — via repository |
| "Does this entity exist?" | NO | YES — via repository |
| Calling `save()` on repository | NO | YES |
| Orchestrating multiple entities | NO | YES |
