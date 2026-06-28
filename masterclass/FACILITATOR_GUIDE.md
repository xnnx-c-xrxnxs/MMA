# Facilitator Guide

> For the **lead developer** running the masterclass. How to brief each pair, what "good" looks
> like for the two core patterns, the mistakes to watch for, and how to grade a slice.

---

## The two patterns every project teaches

The whole masterclass is built around making each pair implement these **once, correctly**:

### 1. ACL — synchronous cross-service validation

A domain must validate something owned by **another** bounded context **before** it persists. It
must do so **without** importing the other domain's package or its HTTP types.

**What "good" looks like:**
- An abstract port lives in the consuming domain: `application/interfaces/{thing}-validator.interface.ts`
  defining `I{Thing}Validator` + a small `Validated{Thing}` DTO (only the fields this domain needs).
- The HTTP adapter lives in `infrastructure/clients/` and implements that port. It is the **only**
  place that knows about Axios / URLs / the upstream contract.
- The use case depends on the **interface**, never the adapter. It calls
  `await this.validator.validate(id)` and reacts to typed domain exceptions
  (`{Thing}NotFoundError`, `{Thing}InvalidStateError`) — never an HTTP status.
- The adapter forwards auth + correlation via `getOutboundHeaders()` (Golden Rules #20, #24).
- Reference implementation: `ICustomerValidator` in the frozen `examples/` create-order flow.

**Grade against:** Golden Rules #5 (domain has zero outward deps), #14 (ACL required), #24 (header
propagation). Apply the `sync-cross-service-call` skill.

### 2. Choreography saga — async request→reply across two contexts

An operation can't be resolved synchronously, so the originating domain persists in a **pending**
state, publishes an event, and a handler in the other context replies with an event that resolves
the state.

**What "good" looks like:**
- Originating use case persists in a non-terminal state (`DRAFT` / `PENDING` / `REQUESTED`) and
  publishes a domain event via `IEventPublisher<T>` (FIFO, grouped by the aggregate id).
- A dedicated **event-handler service** (no HTTP, no Swagger) consumes the event, runs a pure
  domain use case, and publishes a **reply** event (`*_SUCCEEDED` / `*_FAILED`).
- The originating context consumes the reply and transitions to a terminal state.
- The handler is **idempotent**: replaying an event after the aggregate already moved past the
  pending state is a silent no-op (log + skip), not a crash or a double-apply.
- Event schemas live in `@old-st/contracts/{publishing-domain}` and include
  `correlationId: z.string().optional()` (Golden Rules #15, #20).

**Grade against:** Golden Rules #15 (consume contracts, not domain packages), idempotency,
correlation propagation. Apply the `choreography-saga` + `cross-domain-event-handler` skills.

---

## Common mistakes to watch for (and the rule they break)

| Mistake | Golden Rule | How to catch it |
|---|---|---|
| Controller calls a use case directly (skips the application service) | #1, #2 | Read the controller — it should only touch the application service. |
| Use case returns a DTO instead of a domain entity | #3, #4 | The Zod `schema.parse()` should happen in the application service, not the use case. |
| ACL adapter's HTTP types leak into the use case | #5, #14 | The use case file should have **zero** imports from `infrastructure/clients/` or `axios`. |
| Cross-domain consumer imports `@old-st/{other}-domain` | #15 | Grep the event-handler for `-domain` imports — only `@old-st/contracts/{other}` is allowed. |
| Mixing cursor + offset pagination in one domain | #16 | Prisma domains → offset; Dynamo domains → cursor. Check the list endpoint shape. |
| Hardcoded status/role string (`'ACTIVE'`) | #8 | Should use the domain enum object (`AssetStatusEnum.AVAILABLE`). |
| Trusting `userId` from the request body | #10, #23 | Actor must come from `@CurrentUser('userId')`, never `@Body()`. |
| Non-idempotent saga handler (double-applies on replay) | — | Submit the same event twice; the aggregate must not change the second time. |
| `new Logger()` instead of `createLogger()` | #19 | Grep for `@nestjs/common` Logger. |
| Bare `@old-st/contracts` import | #11 | Must be `@old-st/contracts/{domain}`. |

---

## Suggested cadence (2 weeks per pair)

**Week 1 — Backend spine (BE dev leads, FE pairs/reviews)**
1. Scaffold the core domains (`/new-domain` or `/new-domain-dynamo`) — entities, repos, CRUD use cases.
2. Add the **ACL seam** to the gate-keeper use case (`/new-feature` + `sync-cross-service-call`).
3. Build the **saga**: publish the request event, build the event-handler service, publish the reply,
   consume + transition (`/new-event-service` + `choreography-saga`). Prove idempotency.
4. Backend tests to threshold (domain 80%, service 70%).

**Week 2 — Frontend slice (FE dev leads, BE pairs/reviews)**
5. Client hooks in `@old-st/client-common` (`webapp-api-client-hooks`).
6. List page + data-table + status badges (`/webapp-feature`).
7. Create/edit form (react-hook-form + Zod from contracts) and the status-transition action.
8. (Optional) Mobile screen (`/mobile-feature`); E2E happy path (`/new-e2e-tests`).

A pair can **exit after any step** with compilable, tested code — the projects are sequenced so the
ACL and saga land before the UI consumes them.

---

## How to verify a pair's slice

1. **Build + test affected projects:** `npx nx affected -t build test --skip-nx-cache`. Domain
   packages must hit 80%, services/frontend 70%.
2. **ACL rejection path:** call the gate-keeper endpoint with an id the upstream rejects (e.g. an
   inactive employee / archived project / sold-out event). Expect a typed domain exception mapped to
   the right HTTP status by `DomainExceptionFilter` — **not** a 500 and **not** a persisted record.
3. **Saga happy path:** trigger the originating action, watch the request event → reply event →
   terminal state. Confirm the same `correlationId` threads through both events in the logs.
4. **Saga idempotency:** replay the reply event (re-deliver the SQS message). The aggregate must not
   move twice; the handler should log "already resolved, skipping".
5. **Boundary grep:** confirm no cross-domain `-domain` imports and no bare `@old-st/contracts`.

---

## Picking projects for your cohort

- **Least experienced pair →** E (Asset Loan): 3 small domains, simplest saga (reserve / release).
- **Solid pair, wants DynamoDB →** B (Clockify) or D (Event Registration): access-pattern design,
  GSIs, cursor pagination, atomic counters.
- **Solid pair, wants relational →** A (HR Leave): balances + transactional decrements, approval flow.
- **Stretch pair →** C (Helpdesk): routing/assignment saga + SLA timers, richest state machine.

Run two pairs on the **same persistence** (e.g. both Prisma) and compare implementations at the
retro — divergence in how they structured the ACL or saga is the best teaching moment.
