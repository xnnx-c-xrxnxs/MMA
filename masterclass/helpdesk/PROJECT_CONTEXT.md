# Project Context — Helpdesk / Ticketing

> **Masterclass project C** · Difficulty 🔴 Stretch · Persistence **Prisma + PostgreSQL** (offset pagination).
> **🎨 Figma:** [Helpdesk — project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2036-2) · [component library](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) (file: *Masterclass Project Designs*).
> The AI must read this file at the start of every session. Deeper rules live in [CLAUDE.md](../../CLAUDE.md).

---

## 1. What This Project Is

A **customer-support helpdesk**. Customers raise tickets; the system auto-routes each new ticket to
an available agent; agents work, escalate, and resolve them under SLA timers. It is the richest
state machine in the masterclass (ticket lifecycle + SLA + capacity-based routing), making it the
**stretch** project — relational (tickets ↔ comments ↔ agents) so **Prisma** with offset pagination.

The "spine": assigning a ticket **synchronously validates the target agent is AVAILABLE and under
capacity (ACL)**; creating a ticket triggers a **routing saga** that picks an available agent
asynchronously and either assigns the ticket or escalates when none is free.

---

## 2. Bounded Contexts (Domains)

> Source of truth: [issue-config.json](issue-config.json) `domains[]`.

| Domain | Persistence | Service(s) | Role |
|---|---|---|---|
| `ticket` | Prisma + PostgreSQL | `ticket-api-service`, `ticket-event-handler-service` | Tickets, comments, priority, SLA (originates the ACL call + the saga). |
| `agent` | Prisma + PostgreSQL | `agent-api-service`, `agent-event-handler-service` | Support agents, availability, capacity (ACL target; picks an agent in the saga). |
| `customer` | Prisma + PostgreSQL | `customer-api-service` | Requesters, company, tier. |
| `team` *(stretch → 4 domains)* | Prisma + PostgreSQL | `team-api-service` | Agent teams + routing queues. |
| `knowledge-base` *(stretch → 5 domains)* | Prisma + PostgreSQL | `kb-api-service` | Articles suggested on ticket creation. |

**Cross-cutting:** `webapp`, `mobile`, `infra`, `cross-domain`, `auth`.

---

## 3. User Roles

- `ADMIN` — manage agents, teams, SLA policies; reassign any ticket.
- `AGENT` — work assigned tickets, comment, escalate, resolve.
- `CUSTOMER` — raise tickets, comment on own tickets, view status.

### Identity & user provisioning

`agent` is the **support domain record** (team, capacity, availability); the **login identity is owned
by the `auth` service (Cognito)** — linked, not the same object. An agent references its auth identity
via `userId`. **Adding an agent provisions a login with the `AGENT` role**: the admin enters name +
email + team + capacity → the system creates the `agent` record **and** calls the `auth`
admin-create/invite endpoint (a **synchronous cross-service call**, `getOutboundHeaders()`); the agent
sets their password from the email invite. At runtime `@CurrentUser()` (JWT) resolves to the agent by
`userId`. `customer` identities are provisioned the same way (admin add, or self sign-up on first
ticket). Same **cross-service/ACL pattern** as agent assignment (Golden Rules #14 / #24).

---

## 4. Tech Stack

NestJS 11 · Node 24 · **Prisma 5 + PostgreSQL 16** · Zod contracts · SQS FIFO · Next.js 15 webapp ·
`@old-st/telemetry`. (Full table: [docs/PROJECT_CONTEXT.md §4](../../docs/PROJECT_CONTEXT.md).)

---

## 5. Architectural Rules That Affect Every Issue

- Clean-Arch layering; application services always present.
- **Prisma → offset pagination**. Never cursor (#16). Schema enums mirror domain constants (#17);
  generated client is infra-only (#18).
- Contracts via `@old-st/contracts/{domain}` subpath only (#11); actor from `@CurrentUser()` (#23).
- **ACL:** `ticket` validates `agent` via an abstract port + HTTP adapter (#14).
- **Cross-domain events:** consumers import `@old-st/contracts/ticket` — never `@old-st/ticket-domain` (#15).

---

## 6. Workflow Prompts

| Scope | Prompt |
|---|---|
| New domain (Prisma) | `/new-domain` |
| Feature / ACL | `/new-feature` (+ `sync-cross-service-call` skill) |
| Saga / SQS consumer | `/new-event-service` (+ `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |

---

## 7. Standard Patterns

REST plural nouns (`/tickets`, `/agents`); actions as POST sub-resources
(`POST /tickets/:id/assign`, `/escalate`, `/resolve`). Status badges via `status-variants.ts`.
Forms via react-hook-form + Zod from `@old-st/contracts/{domain}`.

---

## 8–9. Effort & Priority Heuristics

XS≤2h · S≤8h · M≤16h · L≤32h · XL>32h · P0–P3. (See [docs/PROJECT_CONTEXT.md §8–9](../../docs/PROJECT_CONTEXT.md).)

---

## 11. Domain Entities

### `ticket` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| customerId | ulid | FK → customer |
| subject | string | |
| description | string | |
| priority | enum | `LOW, MEDIUM, HIGH, URGENT` |
| status | enum | `OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED` |
| assignedAgentId | ulid | optional |
| slaDueAt | datetime | derived from priority |
| comments | relation | `TicketComment[]` |

### `agent` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| email | string | unique |
| userId | ulid | FK → `auth` identity (Cognito sub); set when the invite is provisioned |
| teamId | ulid | FK (stretch) |
| status | enum | `AVAILABLE, BUSY, OFFLINE` |
| openTicketCount | integer | guarded |
| maxCapacity | integer | default 5 |

### `customer` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| email | string | unique |
| company | string | optional |
| tier | enum | `FREE, PRO, ENTERPRISE` (affects SLA) |

---

## 12. Business Rules & Invariants

- **ACL gate:** `ticket.assign` calls `IAgentValidator.validate(agentId)`. Rejects with
  `AgentUnavailableError` / `AgentAtCapacityError` unless the agent is `AVAILABLE` and
  `openTicketCount < maxCapacity`. No assignment persists on failure.
- `slaDueAt` is computed from `priority` (and customer `tier` in the stretch): `URGENT` = 1h,
  `HIGH` = 4h, `MEDIUM` = 1 business day, `LOW` = 3 business days.
- **Ticket lifecycle:** `OPEN → ASSIGNED` (saga success) · `OPEN → ESCALATED` (no agent) ·
  `ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED` · any state `→ ESCALATED` on SLA breach.
- Assigning increments the agent's `openTicketCount`; resolving decrements it.

### ACL seam (synchronous)
`ticket.assign` → `IAgentValidator.validate(agentId)` → `ValidatedAgent { agentId, status, hasCapacity }`.
Port in `ticket-domain/application/interfaces/`; HTTP adapter in `infrastructure/clients/` calling
`agent-api-service`. Forward auth + correlation via `getOutboundHeaders()`.

### Choreography saga (asynchronous)
1. `ticket.create` persists ticket `OPEN` and publishes **`TICKET_CREATED`** (`@old-st/contracts/ticket`).
2. `agent-event-handler-service` consumes it, runs `PickAvailableAgentUseCase` (lowest-load available
   agent), replies **`TICKET_ASSIGNED`** (with `agentId`) or **`NO_AGENT_AVAILABLE`**
   (`@old-st/contracts/agent`).
3. `ticket-event-handler-service` consumes the reply → ticket `ASSIGNED` (set `assignedAgentId`) or
   `ESCALATED`. A separate SLA-breach timer publishes `TICKET_SLA_BREACHED` → escalate. **Idempotent**.

---

## 10. Where to Find Things

Golden Rules → [CLAUDE.md](../../CLAUDE.md) · Workflows → [.claude/commands/](../../.claude/commands/) ·
Skills → [.claude/skills/](../../.claude/skills/) · Handbook → [docs/engineering-handbook.md](../../docs/engineering-handbook.md).
