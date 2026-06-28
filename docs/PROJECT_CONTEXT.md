# Project Context

> **Purpose:** This file gives the AI Issue Creator (and any AI assistant working on issues) a fast, factual snapshot of this codebase. The AI **must** read this file at the start of every session.
>
> When the answer to a question is "see `CLAUDE.md`", that file is the deeper source of truth. This file is the index.

---

## 1. What This Project Is

`helpdesk` is a **support ticketing platform** built on a full-stack Clean Architecture monorepo (Nx) deployed to AWS. Customers raise tickets; each new ticket is **auto-routed to an available agent** via an asynchronous choreography saga; **SLA targets are derived per customer tier** and tickets **escalate automatically on breach**. It ships:

- **Backend microservices** — NestJS on Lambda. HTTP API services (`ticket`, `agent`, `customer`, `team`, `auth`) plus SQS event-handler services that run the auto-routing saga, maintain agent load, and process SLA breaches.
- **Webapp** — Next.js App Router (Tailwind v4, shadcn-style UI primitives, React Query): the agent ticket workspace, agent roster, teams page, and a customer self-service portal.
- **CD pipeline** — Terraform child modules driven by `.github/service-registry.json` (zero-edit deploys for new services).
- **Workflow prompts + skills** — `.claude/commands/` and `.claude/skills/` automate Clean Architecture-compliant feature development.

> **Persistence:** every business domain (`ticket`, `agent`, `customer`, `team`) uses **DynamoDB (OneTable, single-table design) with cursor pagination** — not Prisma. Access patterns are enumerated as GSIs up front (see §11). `auth` is Cognito-backed.
>
> **Scope:** the ACTIVE backlog is [`HELPDESK_DOCUMENTATION/user-stories.active.csv`](../HELPDESK_DOCUMENTATION/user-stories.active.csv) (21 stories). `knowledge-base` (article suggestions on ticket creation) is a documented **STRETCH** domain — deferred, not built, and intentionally absent from `issue-config.json`.

---

## 2. Bounded Contexts (Domains)

> **Source of truth:** [.github/issue-config.json](../.github/issue-config.json) — `domains[]` and `crossCutting[]`.
> The table below is the human-readable view. **When you add or remove a domain, edit `issue-config.json` first**, then re-run `node scripts/task-helpers/setup-github-labels.mjs` and update this table + the `Domain` dropdown in `.github/ISSUE_TEMPLATE/*.yml`.

| Domain | Persistence | Service(s) |
|---|---|---|
| `ticket` | DynamoDB OneTable | `ticket-api-service`, `ticket-event-handler-service` |
| `agent` | DynamoDB OneTable | `agent-api-service`, `agent-event-handler-service` |
| `customer` | DynamoDB OneTable | `customer-api-service` |
| `team` | DynamoDB OneTable | `team-api-service` |
| `auth` | Cognito (deployed) / `LocalAuthProvider` (local) | `auth-api-service` |

**Cross-cutting surfaces** (not bounded contexts, but valid `domain-*` labels):
`webapp`, `infra`, `cross-domain`, `new-domain`.

> **STRETCH (documented, not built):** `knowledge-base` — suggested articles on ticket creation; a parallel, non-blocking consumer of `TICKET_CREATED`. Lives in [`HELPDESK_DOCUMENTATION/`](../HELPDESK_DOCUMENTATION/) only and is deliberately excluded from `issue-config.json` until promoted.

Add new domains via the `/new-domain` (or `/new-domain-dynamo`) workflow prompt — and remember the `issue-config.json` + dropdown sync.

---

## 3. User Roles

Identity is owned by `auth` (Cognito). `agent` and `customer` records link to it via `userId` (the Cognito sub). The actor is always resolved at runtime from the JWT via `@CurrentUser()` (Golden Rules #23/#24) — never trusted from the request body or params (#10).

- `ADMIN` — registers customers, agents and teams; provisions agent/customer logins via email invite; assigns / reassigns tickets through the ACL gate; may author `PUBLIC` and `INTERNAL` comments.
- `AGENT` — works the queue; starts / resolves / escalates assigned tickets; toggles own availability (`AVAILABLE ↔ BUSY ↔ OFFLINE`, which drives routing); may author `PUBLIC` and `INTERNAL` comments.
- `CUSTOMER` — raises tickets and tracks the status of their own; may author only `PUBLIC` comments, and only on a ticket whose `customerId` matches their own identity.

A comment's `authorRole` (`AGENT | CUSTOMER | ADMIN`) snapshots who wrote it. Role enums live in the domain constants — never hardcode role strings (#8).

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 |
| Runtime | Node.js 24 (Lambda `nodejs24.x`) |
| Validation | Zod (in `packages/contracts/{domain}/`) |
| Persistence (NoSQL) | DynamoDB OneTable v2 |
| Persistence (SQL) | Prisma 5 + PostgreSQL 16 (RDS) |
| Auth | AWS Cognito (deployed), JWT JWKS verification |
| Eventing | SQS Standard + FIFO via `@mma/aws-sqs` |
| Telemetry | OpenTelemetry + structured JSON logs (`@mma/telemetry`) + CloudWatch + X-Ray |
| Webapp | Next.js 15 App Router, Tailwind v4, shadcn primitives, React Query, react-hook-form + Zod resolver |
| Mobile | Expo SDK 52, Expo Router, React Query, `@mma/mobile-ui` primitives |
| IaC | Terraform (child modules + per-environment roots) |
| CI/CD | GitHub Actions, GitHub OIDC → AWS, Nx affected |
| Monorepo | Nx 19 + pnpm workspaces |

---

## 5. Architectural Rules That Affect Every Issue

The full list is in [CLAUDE.md](../CLAUDE.md) — Golden Rules #1–#46. Highlights every BA / dev / AI must respect when scoping issues:

- **Clean Architecture layering** — Presentation → Application → Use Cases → Domain → Infrastructure. Inner never depends on outer.
- **Application services always exist** — controllers never call use cases directly.
- **Contracts via subpath imports only** — `@mma/contracts/{domain}`, never bare `@mma/contracts`.
- **Pagination per persistence** — DynamoDB → cursor; Prisma → offset. Never mix within a domain.
- **Authenticated actor from JWT only** — `@CurrentUser()` decorator, never from request body.
- **Refresh tokens are httpOnly cookies; access tokens memory-only** (no localStorage).
- **All file uploads/downloads go through `file-api-service` via S3 presigned URLs** — domain services never touch S3.
- **Structured logging via `createLogger()` from `@mma/telemetry`** — never `new Logger()` from `@nestjs/common`.
- **CorrelationId propagated across HTTP + SQS** — via `correlationMiddleware()` and `getOutboundHeaders()`.
- **Service registry-driven CD** — adding a service = editing `.github/service-registry.json`, not Terraform `.tf` files.

---

## 6. Workflow Prompts (Choose One per Issue)

| Issue scope | Prompt |
|---|---|
| New bounded context | `/new-domain` (or `/new-domain-dynamo`, `/quick-crud-domain`) |
| New feature in existing backend domain | `/new-feature` |
| Backend + webapp + mobile slice | `/full-stack-feature` |
| Webapp page only | `/webapp-feature` |
| New microservice | `/new-service` |
| SQS publisher / consumer / saga | `/new-event-service` |
| Single use case | `/new-use-case` |
| E2E tests | `/new-e2e-tests` |
| New shared UI primitive | `/new-ui-primitive` |
| Accessibility audit | `/fe-accessibility-pass` |
| Mobile release | `/mobile-release` |
| Push notifications | `/add-push-notifications` |
| Monitoring tool feature | `/add-monitoring-feature` |
| New alarm channel | `/add-alerting` |
| Sprint triage / bundling | `/triage-sprint` |

The full list with trigger phrases is in [CLAUDE.md §11](../CLAUDE.md) under "Workflow Orchestrators".

---

## 7. Standard Patterns

### REST conventions (Golden Rule §5)

- Plural nouns (`/users`, `/orders`).
- kebab-case multi-word (`/order-items`).
- State-changing actions as POST sub-resources (`POST /users/:userId/activate`).
- Path params for identity, query params for filtering.

### Status badge mapping (Webapp / Mobile)

`status-variants.ts` files map domain enums (`USER_STATUSES`, `ORDER_STATUSES`, `PRODUCT_STATUSES`) to badge variants. Never hardcode status strings.

### Forms (Webapp)

`react-hook-form` + Zod resolver, schema imported from `@mma/contracts/{domain}`. See `webapp-form-with-validation` skill.

### Toast feedback

All mutations use `toast` from `@mma/ui`. `<Toaster>` is mounted once in `apps/webapp/src/app/layout.tsx`.

---

## 8. Effort Sizing Heuristics

Use these when filling the **Effort** field on issues:

| Effort | Definition | Examples |
|---|---|---|
| **XS** | ≤ 2h | Add a `data-testid`, fix a typo, bump a dependency, add a status to an existing enum + cascade. |
| **S** | ≤ 8h | Add a single endpoint to an existing service + tests; add a webapp filter; add a new ESLint rule. |
| **M** | ≤ 16h | New use case + repository method + endpoint + webapp UI; new shared UI primitive + adoption in 1–2 places. |
| **L** | ≤ 32h | Full-stack vertical slice (backend + webapp + mobile) for a new capability on an existing domain. |
| **XL** | > 32h | New domain (`/new-domain`); choreography saga across two domains; new microservice + Terraform wiring. |

---

## 9. Priority Heuristics

| Priority | When to use |
|---|---|
| **Critical (P0)** | Production down or blocked release. Drop everything. |
| **High (P1)** | Sprint-critical — must ship this sprint. |
| **Medium (P2)** | Planned for the sprint but not blocking. |
| **Low (P3)** | Backlog / nice-to-have / tech debt. |

---

## 10. Where to Find Things

| Looking for | Path |
|---|---|
| Architectural rules + Golden Rules | [CLAUDE.md](../CLAUDE.md) |
| Per-domain conventions | the nested `CLAUDE.md` in the relevant app/package (e.g. [apps/webapp/CLAUDE.md](../apps/webapp/CLAUDE.md)) |
| Workflow prompts | [.claude/commands/](../.claude/commands/) |
| Reusable skills | [.claude/skills/](../.claude/skills/) |
| Service / infra registry | [.github/service-registry.json](../.github/service-registry.json) |
| Per-service env vars | [.github/service-registry.env](../.github/service-registry.env) |
| Documentation | [docs/](./) |
| Local dev getting started | [docs/getting-started.md](getting-started.md) |
| Helpdesk domain docs (behaviour contract) | [HELPDESK_DOCUMENTATION/domains/](../HELPDESK_DOCUMENTATION/domains/) |
| Active backlog (21 stories) | [HELPDESK_DOCUMENTATION/user-stories.active.csv](../HELPDESK_DOCUMENTATION/user-stories.active.csv) |

---

## 11. Domain Entities (Active Scope)

> Source of truth: [`HELPDESK_DOCUMENTATION/domains/`](../HELPDESK_DOCUMENTATION/domains/). All business domains are DynamoDB (OneTable). IDs are ULIDs. Every entity carries `dateCreated` + `updatedAt` (Golden Rule #12 — never a domain-level `createdAt`). Enums use domain constant objects, never string literals (#8).

### `ticket` domain

**`Ticket`** — the spine (origin of the ACL, the routing saga, and SLA).

| Field | Type | Meaning |
|---|---|---|
| `id` | ulid | PK |
| `customerId` | ulid | requester (→ customer); GSI |
| `subject` | string (1–200) | |
| `description` | string (1–5000) | |
| `priority` | enum `LOW \| MEDIUM \| HIGH \| URGENT` | drives SLA |
| `status` | enum `OPEN \| ASSIGNED \| IN_PROGRESS \| RESOLVED \| CLOSED \| ESCALATED` | GSI |
| `assignedAgentId` | ulid? | set by saga / reassignment; GSI |
| `teamId` | ulid? | optional routing scope |
| `slaDueAt` | datetime | derived from `priority` × customer `tier` at creation; immutable thereafter |
| `firstResponseAt` / `resolvedAt` / `closedAt` | datetime? | lifecycle stamps |
| `escalationReason` | string? | set on entering `ESCALATED` |

**`TicketComment`** — a **separate DynamoDB item type** (not a join), same `ticket` domain/package.

| Field | Type | Meaning |
|---|---|---|
| `id` | ulid | PK |
| `ticketId` | ulid | GSI partition — list a ticket's comments |
| `authorId` | ulid | from `@CurrentUser()`, never from body (#10/#23) |
| `authorRole` | enum `AGENT \| CUSTOMER \| ADMIN` | snapshot of who wrote it |
| `body` | string (1–5000) | |
| `visibility` | enum `PUBLIC` (customer-visible) \| `INTERNAL` (agent-only) | |

### `agent` domain — **`Agent`** (ACL target + saga picker)

| Field | Type | Meaning |
|---|---|---|
| `id` | ulid | PK |
| `name` | string (1–120) | |
| `email` | string (email) | unique (GSI + conditional write) |
| `userId` | ulid? | Cognito sub; set on invite provisioning; GSI |
| `teamId` | ulid? | → team; GSI |
| `status` | enum `AVAILABLE \| BUSY \| OFFLINE` | GSI (picker queries AVAILABLE) |
| `openTicketCount` | integer ≥ 0 | **event-maintained** by `agent-event-handler-service`, not written by the ticket context |
| `maxCapacity` | integer (default 5, ≥ 1) | `hasCapacity` = `openTicketCount < maxCapacity` (derived getter) |

### `customer` domain — **`Customer`** (leaf context; tier feeds SLA)

| Field | Type | Meaning |
|---|---|---|
| `id` | ulid | PK |
| `name` | string (1–120) | |
| `email` | string (email) | unique (GSI); **immutable** after creation (auth link) |
| `userId` | ulid? | Cognito sub; GSI |
| `company` | string? | optional |
| `tier` | enum `FREE \| PRO \| ENTERPRISE` | drives SLA targets |
| `status` | enum `ACTIVE \| INACTIVE` | soft-disable; keeps ticket history |

### `team` domain — **`Team`** (routing scope)

| Field | Type | Meaning |
|---|---|---|
| `id` | ulid | PK |
| `name` | string (1–80) | unique (GSI) |
| `description` | string? | optional |
| `routingStrategy` | enum `LOWEST_LOAD` (default) \| `ROUND_ROBIN` | how the picker orders candidates |
| `status` | enum `ACTIVE \| ARCHIVED` | |

> Team membership lives on the agent (`agent.teamId`) — one agent in at most one team. "List a team's agents" is an `agent` GSI query, not a join.

---

## 12. Business Rules, Lifecycle & Events

### Ticket lifecycle

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED        (any non-terminal state → ESCALATED)
```

- `OPEN → ASSIGNED`: saga reply `TICKET_ASSIGNED` sets `assignedAgentId` (agent load ++). `OPEN → ESCALATED`: saga reply `NO_AGENT_AVAILABLE`.
- `ASSIGNED → IN_PROGRESS` stamps `firstResponseAt`; `IN_PROGRESS → RESOLVED` stamps `resolvedAt` + publishes `TICKET_RESOLVED`; `RESOLVED → CLOSED` stamps `closedAt`. `CLOSED` is terminal; `ESCALATED` is re-routable by an admin.
- Manual `* → ASSIGNED` (admin assign/reassign) must pass the **agent-validator ACL** before persisting.

### Key invariants

- **Capacity:** an agent's `openTicketCount` never exceeds `maxCapacity`. Both the saga picker and the ACL reject unless `status == AVAILABLE && openTicketCount < maxCapacity` (`AgentUnavailableError` / `AgentAtCapacityError`).
- **Load ownership:** the ticket context never writes the agent table. `agent-event-handler-service` maintains `openTicketCount` by consuming `TICKET_ASSIGNED`/reassign-in (`++`) and `TICKET_RESOLVED`/reassign-out (`--`, floored at 0), deduped by `ticketId` + event id.
- **SLA freeze:** `slaDueAt = f(priority, tier)` at creation and is immutable; changing a customer's tier does **not** retro-update existing tickets.
- **Comment visibility:** a `CUSTOMER` may create only `PUBLIC` comments, and only on a ticket whose `customerId` matches their identity; `INTERNAL` comments are agent/admin only.
- **Uniqueness without SQL:** agent email, customer email, and team name are enforced via dedicated GSIs + conditional writes.
- **No silent fallback:** a ticket scoped to a `teamId` with no AVAILABLE agents yields `NO_AGENT_AVAILABLE → ESCALATED` — it deliberately does **not** fall back to the global pool, so leads see the gap.

### Events (SQS FIFO; all handlers idempotent)

| Event | Published by | Consumed by |
|---|---|---|
| `TICKET_CREATED` | `ticket` | `agent-event-handler` (picker) |
| `TICKET_ASSIGNED` / `NO_AGENT_AVAILABLE` | `agent` (saga reply) | `ticket-event-handler` |
| `TICKET_RESOLVED` / `TICKET_REASSIGNED` | `ticket` | `agent-event-handler` (load adjust) |
| `TICKET_SLA_BREACHED` | SLA-breach timer (`ticket`) | `ticket-event-handler` (→ ESCALATED) |

### Cross-domain seams

- **Agent-validator ACL (sync):** `AssignTicketUseCase → IAgentValidator` (port in `ticket` `application/interfaces/`) → HTTP adapter in `infrastructure/clients/` → `agent-api-service`. Forwards auth + correlation via `getOutboundHeaders()` (#24). Golden Rule #14. Skill: `sync-cross-service-call`.
- **Auto-routing saga (async):** `ticket` publishes `TICKET_CREATED`; `agent-event-handler` runs `PickAvailableAgentUseCase` (lowest-load AVAILABLE agent, team-scoped if `teamId` set) and replies `TICKET_ASSIGNED` | `NO_AGENT_AVAILABLE`; `ticket-event-handler` resolves the ticket state. Skill: `choreography-saga`.
- **Agent provisioning (sync → auth):** `CreateAgentUseCase → IAuthProvisioner` → auth admin-create/invite with the `AGENT` role; stores the returned `userId`. If auth fails, no agent persists.
- **Bounded-context isolation:** cross-domain consumers import only the publisher's **contracts** (`@mma/contracts/{domain}`), never its domain package (#15).

---

## 13. Non-Functional Requirements

- **SLA targets** — `slaDueAt` derived at creation from `priority` × customer `tier`:

  | | FREE | PRO | ENTERPRISE |
  |---|---|---|---|
  | URGENT | 2h | 1h | 30m |
  | HIGH | 8h | 4h | 2h |
  | MEDIUM | 2 business days | 1 business day | 4h |
  | LOW | 4 business days | 3 business days | 1 business day |

  A breach timer compares `now > slaDueAt` for any non-terminal ticket and publishes `TICKET_SLA_BREACHED`. (Admin-configurable SLA policy is a deferred enhancement; the active build uses this constant matrix.)
- **Idempotent event handlers** — every SQS consumer must be idempotent: saga replies are no-ops once the ticket has left `OPEN`; load adjustments dedupe by `ticketId` + event id. Events ride **SQS FIFO**.
- **Cursor pagination everywhere** (Golden Rule #16) — every list endpoint returns `IPaginatedResponse { items, nextCursorPointer, prevCursorPointer }`. No offset, no `total`. **No full-table scans** — every list is by a declared PK/GSI partition.
- **Auth model** — Cognito identity; two-tier auth (API Gateway JWT authorizer + NestJS guard). Actor resolved per request from the JWT via `@CurrentUser()`; never from client input (#10/#23). Provisioning is a sync cross-service call to `auth` via an ACL adapter forwarding `Authorization` + `x-correlation-id` (#24).
- **End-to-end correlation** — `correlationMiddleware()` first in the chain; `correlationId` on every event payload, auto-injected by SQS publishers and propagated by ACL adapters.
