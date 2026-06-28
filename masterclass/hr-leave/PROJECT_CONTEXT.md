# Project Context — HR Leave Management

> **Masterclass project A** · Difficulty 🟡 Core · Persistence **Prisma + PostgreSQL** (offset pagination).
> **🎨 Figma:** [HR Leave — project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2033-2) · [component library](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) (file: *Masterclass Project Designs*).
> The AI must read this file at the start of every session. Deeper rules live in [CLAUDE.md](../../CLAUDE.md).

---

## 1. What This Project Is

An **HR leave / time-off** system. Employees submit leave requests against their balances; managers
approve or reject; HR admins manage employees, leave types, and the public-holiday calendar. It is a
relational project (balances, departments, approval chains, transactional decrements) — a strong
**Prisma** teaching case with offset pagination.

The "spine": submitting a request **synchronously validates the employee is ACTIVE, has a valid
manager, and has enough balance (ACL)**; once submitted, a **saga** reserves the balance and resolves
the request to `PENDING_APPROVAL` or `REJECTED`; approval deducts the reserved balance.

---

## 2. Bounded Contexts (Domains)

> Source of truth: [issue-config.json](issue-config.json) `domains[]`.

| Domain | Persistence | Service(s) | Role |
|---|---|---|---|
| `employee` | Prisma + PostgreSQL | `employee-api-service`, `employee-event-handler-service` | Employees, manager links, leave balances (ACL target; reserves/deducts balance in the saga). |
| `leave` | Prisma + PostgreSQL | `leave-api-service`, `leave-event-handler-service` | Leave requests, leave types, approval workflow (originates the ACL call + the saga). |
| `holiday` | Prisma + PostgreSQL | `holiday-api-service` | Public-holiday calendar (consulted when computing leave days). |
| `department` *(stretch → 4 domains)* | Prisma + PostgreSQL | `department-api-service` | Org units + approver hierarchy. |
| `notification` *(stretch → 5 domains)* | Prisma + PostgreSQL | `notification-event-handler-service` | Emails managers/employees on status changes (event consumer). |

**Cross-cutting:** `webapp`, `mobile`, `infra`, `cross-domain`, `auth`.

---

## 3. User Roles

- `ADMIN` — HR: manage employees, leave types, holidays; see all requests; adjust balances.
- `MANAGER` — approve/reject direct reports' requests.
- `EMPLOYEE` — submit/cancel own requests; view own balance.

### Identity & user provisioning

`employee` is the **HR domain record** (balances, manager, department); the **login identity is owned
by the `auth` service (Cognito)** — linked, not the same object. An employee references its auth
identity via `userId`. **Adding an employee provisions a login**: the admin enters name + email +
department + manager + starting balances → the system creates the `employee` record **and** calls the
`auth` admin-create/invite endpoint (a **synchronous cross-service call**, forwarding correlation +
auth via `getOutboundHeaders()`); the person sets their password from the email invite on first
sign-in. At runtime `@CurrentUser()` (JWT) resolves to the employee by `userId`. This is the **same
cross-service/ACL pattern** as the eligibility check (Golden Rules #14 / #24) — a second concrete
example of it. (Async alternative: emit `EMPLOYEE_CREATED` → `auth` provisions via a handler.)

---

## 4. Tech Stack

NestJS 11 · Node 24 · **Prisma 5 + PostgreSQL 16** · Zod contracts · SQS FIFO · Next.js 15 webapp ·
Expo mobile · `@old-st/telemetry`. (Full table: [docs/PROJECT_CONTEXT.md §4](../../docs/PROJECT_CONTEXT.md).)

---

## 5. Architectural Rules That Affect Every Issue

- Clean-Arch layering; application services always present.
- **Prisma → offset pagination** (`data, total, page, limit, totalPages`). Never cursor (#16).
- Prisma schema enums **mirror domain constants exactly** (#17); generated client is infra-only (#18).
- Contracts via `@old-st/contracts/{domain}` subpath only (#11); actor from `@CurrentUser()` (#23).
- **ACL:** `leave` validates `employee` via an abstract port + HTTP adapter (#14).
- **Cross-domain events:** consumers import `@old-st/contracts/leave` — never `@old-st/leave-domain` (#15).

---

## 6. Workflow Prompts

| Scope | Prompt |
|---|---|
| New domain (Prisma) | `/new-domain` |
| Feature / ACL | `/new-feature` (+ `sync-cross-service-call` skill) |
| Saga / SQS consumer | `/new-event-service` (+ `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |
| Mobile screen | `/mobile-feature` |

---

## 7. Standard Patterns

REST plural nouns (`/employees`, `/leave-requests`); actions as POST sub-resources
(`POST /leave-requests/:id/approve`, `/reject`, `/cancel`). Status badges via `status-variants.ts`.
Forms via react-hook-form + Zod from `@old-st/contracts/{domain}`.

---

## 8–9. Effort & Priority Heuristics

XS≤2h · S≤8h · M≤16h · L≤32h · XL>32h · P0–P3. (See [docs/PROJECT_CONTEXT.md §8–9](../../docs/PROJECT_CONTEXT.md).)

---

## 11. Domain Entities

### `employee` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| email | string | unique |
| userId | ulid | FK → `auth` identity (Cognito sub); set when the invite is provisioned |
| firstName / lastName | string | |
| departmentId | ulid | FK (stretch) |
| managerId | ulid | self-FK, optional |
| status | enum | `ACTIVE, INACTIVE, ON_LEAVE` |
| annualLeaveBalance | number | days |
| sickLeaveBalance | number | days |

### `leaveRequest` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| employeeId | ulid | FK → employee |
| leaveType | enum | `ANNUAL, SICK, UNPAID` |
| startDate / endDate | date | |
| days | number | computed (excludes holidays/weekends) |
| status | enum | `DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED` |
| approverId | ulid | optional |
| reason | string | optional |

### `holiday` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| date | date | |
| year | integer | index |
| recurring | boolean | |

---

## 12. Business Rules & Invariants

- **ACL gate:** `leave.submitRequest` calls `IEmployeeValidator.validate(employeeId, leaveType, days)`.
  Rejects with `EmployeeInactiveError` / `NoManagerAssignedError` / `InsufficientBalanceError` unless
  the employee is `ACTIVE`, has a manager, and has enough balance for `leaveType`. No request persists
  on failure.
- `days` excludes weekends and any `holiday` rows in range.
- **Request lifecycle:** `DRAFT → PENDING_APPROVAL` (saga reserve success) · `DRAFT → REJECTED`
  (insufficient balance) · `PENDING_APPROVAL → APPROVED | REJECTED` (manager) · `→ CANCELLED`
  (employee, before approval). Only the assigned `managerId` may approve.
- Approving an `ANNUAL`/`SICK` request **deducts** the reserved days; rejecting/cancelling **releases**
  the reservation. `UNPAID` never touches balances.

### ACL seam (synchronous)
`leave.submitRequest` → `IEmployeeValidator.validate(employeeId, leaveType, days)` →
`ValidatedEmployee { employeeId, status, managerId, balance }`. Port in
`leave-domain/application/interfaces/`; HTTP adapter in `infrastructure/clients/` calling
`employee-api-service`. Forward auth + correlation via `getOutboundHeaders()`.

### Choreography saga (asynchronous)
1. `leave.submitRequest` persists request `DRAFT` and publishes **`LEAVE_REQUEST_SUBMITTED`**
   (`@old-st/contracts/leave`) with `{ employeeId, leaveType, days }`.
2. `employee-event-handler-service` consumes it, runs `ReserveLeaveBalanceUseCase` (transactional),
   replies **`BALANCE_RESERVED`** or **`BALANCE_INSUFFICIENT`** (`@old-st/contracts/employee`).
3. `leave-event-handler-service` consumes the reply → request `PENDING_APPROVAL` | `REJECTED`.
4. On manager approval → publish **`LEAVE_APPROVED`** → employee handler **deducts** the reserved
   balance and sets employee `ON_LEAVE` for the period. **Idempotent** on replay.

---

## 10. Where to Find Things

Golden Rules → [CLAUDE.md](../../CLAUDE.md) · Workflows → [.claude/commands/](../../.claude/commands/) ·
Skills (`new-prisma-schema`, `prisma-repository`) → [.claude/skills/](../../.claude/skills/) ·
Handbook → [docs/engineering-handbook.md](../../docs/engineering-handbook.md).
