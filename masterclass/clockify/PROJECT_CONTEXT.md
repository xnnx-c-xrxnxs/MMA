# Project Context — Clockify (Time Tracking)

> **Masterclass project B** · Difficulty 🟡 Core · Persistence **DynamoDB OneTable** (cursor pagination).
> **🎨 Figma:** [Clockify — project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2030-2) · [component library](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) (file: *Masterclass Project Designs*).
> The AI must read this file at the start of every session. Deeper rules live in [CLAUDE.md](../../CLAUDE.md).

---

## 1. What This Project Is

A team **time-tracking** app (a Clockify clone). Members start/stop timers against projects, submit
weekly timesheets, and managers review them. This is the masterclass's flagship **DynamoDB** project:
time entries are append-heavy and queried by access pattern (`user + date range`, `project + date
range`), which is exactly what OneTable + GSIs + cursor pagination are for.

The "spine": starting a timer **synchronously validates the project is ACTIVE and the user is a
workspace member (ACL)**; submitting a timesheet kicks off a **saga** that aggregates the period's
hours against the project budget and flags overruns.

---

## 2. Bounded Contexts (Domains)

> Source of truth: [issue-config.json](issue-config.json) `domains[]`.

| Domain | Persistence | Service(s) | Role |
|---|---|---|---|
| `workspace` | DynamoDB OneTable | `workspace-api-service` | Workspaces + membership/roles (upstream the ACL validates membership against). |
| `project` | DynamoDB OneTable | `project-api-service`, `project-event-handler-service` | Projects, clients, budgets (ACL target; aggregates budget in the saga). |
| `timeentry` | DynamoDB OneTable | `timeentry-api-service`, `timeentry-event-handler-service` | Time entries + timesheets (originates the ACL call + the saga). |
| `task` *(stretch)* | DynamoDB OneTable | `task-api-service` | Tasks under a project that entries log against. |
| `invoice` *(stretch → 5 domains)* | DynamoDB OneTable | `invoice-api-service` | Bills generated from approved billable time. |

**Cross-cutting:** `webapp`, `mobile`, `infra`, `cross-domain`, `auth`.

---

## 3. User Roles

- `ADMIN` — workspace owner: manage projects, members, budgets; see all timesheets.
- `MANAGER` — review/approve timesheets, see project budget burn.
- `MEMBER` — track time, submit own timesheet.

---

## 4. Tech Stack

NestJS 11 · Node 24 · **DynamoDB OneTable v2** · Zod contracts · SQS FIFO (`@mma/aws-sqs`) ·
Next.js 15 webapp · Expo mobile · `@mma/telemetry`. (Full table: [docs/PROJECT_CONTEXT.md §4](../../docs/PROJECT_CONTEXT.md).)

---

## 5. Architectural Rules That Affect Every Issue

- Clean-Arch layering; application services always present.
- **DynamoDB → cursor pagination** (`items, nextCursorPointer, prevCursorPointer`). Never offset (#16).
- Every repository query passes an explicit **GSI index** param (see `dynamo-repository` skill).
- Contracts via `@mma/contracts/{domain}` subpath only (#11); actor from `@CurrentUser()` (#23).
- **ACL:** `timeentry` validates `project` (+ workspace membership) via an abstract port + HTTP adapter (#14).
- **Cross-domain events:** consumers import `@mma/contracts/timeentry` — never the domain package (#15).

---

## 6. Workflow Prompts

| Scope | Prompt |
|---|---|
| New domain (DynamoDB) | `/new-domain-dynamo` |
| Feature / ACL | `/new-feature` (+ `sync-cross-service-call` skill) |
| Saga / SQS consumer | `/new-event-service` (+ `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |
| Mobile screen | `/mobile-feature` |

---

## 7. Standard Patterns

REST plural nouns (`/projects`, `/time-entries`); actions as POST sub-resources
(`POST /time-entries/:id/stop`, `POST /timesheets/:id/submit`). Status badges via `status-variants.ts`.
Forms via react-hook-form + Zod from `@mma/contracts/{domain}`.

---

## 8–9. Effort & Priority Heuristics

XS≤2h · S≤8h · M≤16h · L≤32h · XL>32h · P0–P3. (See [docs/PROJECT_CONTEXT.md §8–9](../../docs/PROJECT_CONTEXT.md).)

---

## 11. Domain Entities

### `workspace` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| ownerId | ulid | |
| members | json | `[{ userId, role: ADMIN\|MANAGER\|MEMBER }]` |

### `project` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| workspaceId | ulid | GSI1 PK (list by workspace) |
| name | string | |
| clientName | string | optional |
| status | enum | `ACTIVE, ARCHIVED` |
| hourlyRate | number | |
| budgetHours | number | saga compares against |

### `timeentry` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| userId | ulid | **GSI1**: `user + startedAt` (my entries by date) |
| projectId | ulid | **GSI2**: `project + startedAt` (project burn) |
| workspaceId | ulid | |
| description | string | |
| startedAt / stoppedAt | datetime | |
| durationSeconds | integer | |
| billable | boolean | |
| timesheetStatus | enum | `DRAFT, SUBMITTED, APPROVED, FLAGGED` |

---

## 12. Business Rules & Invariants

- **Manual entries:** a member can **add or edit a time entry for a past date** (not only start/stop a
  live timer). Manual entries pass the **same `IProjectValidator` ACL gate**. A running timer has
  `stoppedAt = null`; a manual entry always has both `startedAt` and `stoppedAt` set, with
  `durationSeconds` derived from them.
- **ACL gate:** `timeentry.start` calls `IProjectValidator.validate(projectId, workspaceId, userId)`.
  Rejects with `ProjectInactiveError` / `NotAWorkspaceMemberError` unless the project is `ACTIVE`
  **and** the user is a member of that workspace. No entry persists on failure.
- A user may have **at most one running timer** (entry with `stoppedAt == null`) at a time.
- `durationSeconds` is computed on stop; running entries don't count toward a submitted timesheet.
- **Timesheet lifecycle:** `DRAFT → SUBMITTED` (member) → `APPROVED` | `FLAGGED` (saga result).

### ACL seam (synchronous)
`timeentry.start` → `IProjectValidator.validate(projectId, workspaceId, userId)` →
`ValidatedProject { projectId, status, isMember }`. Port in `timeentry-domain/application/interfaces/`;
HTTP adapter in `infrastructure/clients/` calling `project-api-service` (+ `workspace-api-service` for
membership). Forward auth + correlation via `getOutboundHeaders()`.

### Choreography saga (asynchronous)
1. `POST /timesheets/:id/submit` sets entries `SUBMITTED` and publishes **`TIMESHEET_SUBMITTED`**
   (`@mma/contracts/timeentry`) with `{ projectId, periodStart, periodEnd, totalHours }`.
2. `project-event-handler-service` consumes it, aggregates the period's hours vs `budgetHours`,
   replies **`BUDGET_OK`** or **`BUDGET_EXCEEDED`** (`@mma/contracts/project`).
3. `timeentry-event-handler-service` consumes the reply → timesheet `APPROVED` | `FLAGGED`;
   `BUDGET_EXCEEDED` also fans out a manager notification. **Idempotent** on replay.

---

## 10. Where to Find Things

Golden Rules → [CLAUDE.md](../../CLAUDE.md) · Workflows → [.claude/commands/](../../.claude/commands/) ·
Skills (`dynamo-repository`, `new-dynamo-schema`) → [.claude/skills/](../../.claude/skills/) ·
Handbook → [docs/engineering-handbook.md](../../docs/engineering-handbook.md).
