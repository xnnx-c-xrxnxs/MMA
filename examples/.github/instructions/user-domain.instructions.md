---
applyTo: "packages/user-domain/**,apps/users/**,packages/contracts/user/**"
---

# User Domain Context

This file is automatically loaded when working on any file inside `packages/user-domain/`, `apps/users/`, or `packages/contracts/user/`. It provides the exact current state of the domain so Copilot starts with full context rather than discovering it through searches.

---

## Persistence

- **Strategy:** DynamoDB OneTable (`@old-st/dynamodb-onetable`)
- **Table env var:** `USERS_DYNAMODB_TABLE_NAME`
- **Pagination:** Cursor-based — always return `IPaginatedResponse` (never `IOffsetPaginatedResponse`)
- **Config:** `apps/users/user-api-service/src/infrastructure/config/dynamodb.config.ts`

---

## Entity — `UserEntity`

**File:** `packages/user-domain/src/domain/entities/user.entity.ts`

**Fields:**
| Field | Type | Mutable |
|---|---|---|
| `userId` | `string \| null` | No (readonly) |
| `email` | `string` | No (readonly) |
| `firstName` | `string` | Yes |
| `lastName` | `string` | Yes |
| `emailVerified` | `boolean` | Yes |
| `userRole` | `UserRole` | Yes |
| `userStatus` | `UserStatus` | Yes |
| `data` | `{ country?: string }` | Yes |
| `dateCreated` | `string` | No (readonly) |
| `updatedAt` | `string` | Yes |

**Factories:** `UserEntity.create(props)` for new users, `UserEntity.reconstitute(props)` for loading from persistence.

---

## Domain Constants

**Statuses** (`UserStatusEnum`) — `packages/user-domain/src/domain/constants/user-statuses.ts`:
- `PENDING` — newly registered, email not yet verified
- `ACTIVE` — verified and active
- `INACTIVE` — deactivated by admin
- `DELETED` — soft-deleted (cannot be modified)

**Roles** (`UserRoleEnum`) — `packages/user-domain/src/domain/constants/user-roles.ts`:
- `USER` — standard user
- `ADMIN` — administrator

**Events** (`UserEventTypeEnum`) — `packages/user-domain/src/domain/constants/user-events.ts`:
- `USER_DELETED` — published when a user is deleted

**Golden rule:** Always use `UserStatusEnum.ACTIVE`, `UserRoleEnum.ADMIN`, etc. — never hardcode string literals like `'ACTIVE'`.

---

## Domain Exceptions

All in `packages/user-domain/src/domain/exceptions/`:

| Exception | HTTP mapping | Trigger |
|---|---|---|
| `CannotActivateNonPendingUserError` | 409 | Activate called on non-PENDING user |
| `CannotActivateUnverifiedEmailError` | 409 | Activate called before email verified |
| `CannotDeactivateDeletedUserError` | 409 | Deactivate called on DELETED user |
| `UserAlreadyInactiveError` | 409 | Deactivate called on already-INACTIVE user |
| `UserAlreadyDeletedError` | 409 | Mutating a DELETED user |
| `CannotUpdateDeletedUserError` | 409 | Update profile on DELETED user |
| `CannotChangeRoleOfDeletedUserError` | 409 | Role update on DELETED user |
| `UserAlreadyHasRoleError` | 409 | Assigning the role the user already has |
| `EmailAlreadyVerifiedError` | 409 | Verify email on already-verified user |
| `CannotActivateNonPendingUserError` | 409 | Activation guard |
| `InvalidEmailFormatError` | 409 | Email fails format validation |
| `InvalidNameError` | 409 | firstName/lastName fails validation |

Application exceptions in `packages/user-domain/src/application/exceptions/`.

---

## DynamoDB GSI Access Patterns

**Schema:** `packages/user-domain/src/infrastructure/schemas/UserSchema.ts`

| GSI | PK pattern | SK pattern | Use case |
|---|---|---|---|
| GSI1 | `USER#${userRole}#${userStatus}` | `${email}` | List by role + status |
| GSI3 | `USER#${userStatus}` | `${userRole}` | List by status |
| GSI4 | `USER#${email}` | — | Lookup by email |
| GSI5 | `USER#${userStatus}` | `${email}` | List by status (sorted by email) |
| GSI6 | (configured, check schema) | — | Additional pattern |

**Rules when adding a new query pattern:** If none of the above GSIs support it, add a new GSI to `UserSchema.ts` and update `scripts/setup-localstack.ts` with the new GSI config, then run `pnpm run localstack:setup:force`.

---

## Use Cases

**Location:** `packages/user-domain/src/application/use-cases/`

| Use case | Operation |
|---|---|
| `CreateUserUseCase` | Create new PENDING user |
| `GetUserByIdUseCase` | Get by userId |
| `GetUserByEmailUseCase` | Lookup by email (GSI4) |
| `ListUsersByStatusUseCase` | Cursor-paginated list by status (GSI3/GSI5) |
| `ListUsersByRoleAndStatusUseCase` | Cursor-paginated list by role + status (GSI1) |
| `UpdateUserProfileUseCase` | Update firstName, lastName, country |
| `ActivateUserUseCase` | PENDING → ACTIVE (requires emailVerified) |
| `DeactivateUserUseCase` | ACTIVE → INACTIVE |
| `VerifyUserEmailUseCase` | Sets emailVerified = true |
| `UpdateUserRoleUseCase` | Change role |
| `DeleteUserUseCase` | Soft-delete → DELETED, publishes USER_DELETED event |

**Pattern:** Each use case lives in its own folder with a single `.use-case.ts` file. Constructor receives `I{Entity}Repository` (and ACL validators if needed) via factory injection — never NestJS `@Injectable()` directly.

---

## Services & Apps

| App | Port | Description |
|---|---|---|
| `user-api-service` | `3000` (`USER_SERVICE_PORT`) | HTTP REST API |
| `user-event-handler-service` | — (no HTTP) | SQS consumer for `USER_DELETED` events |

**SQS queue:** `USERS_SQS_QUEUE_URL` / `USERS_SQS_QUEUE_NAME=users-events` (FIFO — queue name resolves to `users-events.fifo`)

**Application service:** `apps/users/user-api-service/src/application/services/user-application.service.ts`

---

## Contracts

**Import path:** `@old-st/contracts/user` — never bare `@old-st/contracts`

**Files:**
- `packages/contracts/user/src/schemas.ts` — Zod input/response schemas
- `packages/contracts/user/src/event-schemas.ts` — SQS event Zod schemas

---

## Cross-Domain Interactions

- **ACL client in order-domain:** `order-api-service/src/infrastructure/clients/user-api.client.ts` calls `GET /users/:userId` to validate customer existence before creating an order. The user domain **does not need to know about this**.
- **USER_DELETED event:** consumed by `user-event-handler-service` (intra-domain pattern). The event handler processes cleanup logic for the deleted user.

---

## Skills to Use

When working in this domain, load these skills as needed:

| Task | Skill |
|---|---|
| Add a new status transition or business rule | `domain-business-rules` |
| Add a new use case | `new-use-case` |
| Update Zod schemas / contracts | `add-contracts` |
| Add a new REST endpoint | `add-api-endpoints` |
| Update the DynamoDB repository | `dynamo-repository` |
| Add a new GSI or query pattern | `new-dynamo-schema` |
| Update `DomainExceptionFilter` | `domain-exception-filter` |
| Add SQS event publishing | `sqs-event-publisher` |
| Write tests | `write-domain-tests` |
| Add a full feature end-to-end | `add-feature-existing-domain` |
