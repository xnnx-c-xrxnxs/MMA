---
description: "Add event-driven communication between domains — publish events, consume events, or implement a choreography saga. USE WHEN user says 'publish events', 'consume events', 'event handler', 'SQS', 'async communication', 'react to events from another domain', 'choreography saga', 'event-driven', or describes a workflow where one domain reacts to another domain's lifecycle events."
---

# New Event Service — Guided Workflow

You are orchestrating the addition of event-driven communication between domains. This covers three patterns: intra-domain events, cross-domain events, and choreography sagas.

> **Generator-first.** Whenever a brand-new event-handler service is needed, you MUST scaffold it with `pnpm exec nx g @mma/nx-plugin:event-handler` instead of writing the boilerplate by hand. Hand-writing `main.ts`, the dispatcher, `SqsLocalService`, `NormalizedSqsRecord`, `IEventHandler`, project.json/tsconfig/jest/webpack, and registry/env wiring is forbidden — those are now deterministic outputs.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **What should happen?** Describe the event flow in plain language.
2. **Publishing domain** — which domain publishes the event?
3. **Consuming domain** — which domain reacts to the event? (same domain = intra-domain, different = cross-domain)
4. **Event types** — which events will be published, in CONSTANT_CASE? (e.g. `USER_DELETED,USER_DEACTIVATED`)
5. **Event payload** — what fields does each event carry? (per event type)
6. **Is this a saga?** Does the consumer publish a result event back to the originator? (request→response cycle = choreography saga)
7. **Idempotency** — can the consuming handler receive the same event twice safely?
8. **Existing infrastructure** — does the publishing service already have an event publisher wired? Does the consuming event-handler service already exist?

### Pattern Detection

| Condition | Pattern |
|---|---|
| Publisher and consumer are in the **same** domain | **A — Intra-domain events** |
| Publisher and consumer are in **different** domains, one-way | **B — Cross-domain events** |
| Publisher and consumer are in **different** domains, with a response event back | **C — Choreography saga** |

**Do not proceed until the pattern is identified and all questions are answered.**

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: sqs-event-driven-service, sqs-event-publisher, cross-domain-event-handler, choreography-saga, contracts-subpath-imports")`
- If consuming events from another domain, also: `Agent(subagent_type="event-flow-tracer", prompt="eventType={EVENT_TYPE_BEING_CONSUMED}")` — confirms current publishers and avoids duplicate handlers.
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=events, thoroughness=medium")`

Use the event-flow trace to confirm queue ownership (consumer-owned inbox pattern, Pattern 2).

---

## Pattern A — Intra-Domain Events

Both publisher and consumer belong to the same bounded context (e.g. `user-api-service` publishes → `user-event-handler-service` consumes).

### Phase A1 — Event Contracts

**Load skill:** `.claude/skills/sqs-event-driven-service/SKILL.md` (Event Constants and Dispatch Pattern section)

- Add event-type constants to domain constants.
- Add per-event payload interfaces to the domain package (exported from the domain barrel — handlers will import them as `{Event}Payload`).
- Add the Zod discriminated union event schema to `packages/contracts/{domain}/src/event-schemas.ts` exported as `{domain}DomainEventSchema` and `{Domain}EventTypeEnum`.

### Phase A2 — Event Publisher (if not already wired)

**Load skill:** `.claude/skills/sqs-event-publisher/SKILL.md`

If the API service does not already publish events, wire it now. When generating a brand-new API service, pass `--publishesEvents=true` to `:service` so the registry/env entries are correct.

### Phase A3 — Event Consumer

**Decision:** does the event-handler service already exist?

#### A3a — Service does NOT exist → use the generator

```bash
pnpm exec nx g @mma/nx-plugin:event-handler \
  --domain={publishing-domain} \
  --eventTypes={EVENT_ONE,EVENT_TWO}
```

This produces (do not edit before this step finishes):

- `apps/{domain}/{domain}-event-handler-service/` with `main.ts`, app/module wiring, dispatcher, per-event handler stubs, `SqsLocalService`, `NormalizedSqsRecord`, `IEventHandler`.
- `project.json`, tsconfig files, jest config, webpack config.
- `service-registry.json` worker entry + SQS queue entry.
- `.env.local.example` SQS env vars.
- `scripts/setup-localstack.ts` queue config.
- `.vscode/tasks.json` `Service: Serve …` + appended to `Services: Start All`.

Then, **for each handler stub** under `src/application/services/handlers/`:

1. Replace the TODO with real reaction logic — call use cases via the constructor.
2. Add the use-case providers to `src/modules/{domain}.module.ts`.
3. If the use case lives in a domain package that doesn't exist yet, scaffold it via `:domain` first.

#### A3b — Service exists → extend in place

Add the new event type to the dispatcher's `switch` and add a new handler file under `handlers/` that mirrors the existing ones. Add the new handler class to `handlers/index.ts` and to the module's `providers` array.

### Phase A4 — Tests (mandatory)

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

For each new handler create `<handler>.spec.ts` next to the source file. Cover:

- Successful dispatch (use case called with correct args).
- Failure path (handler rethrows so SQS does not delete the message).
- Idempotency where applicable.

### Phase A5 — Build gate

```bash
pnpm exec nx build {domain}-event-handler-service --skip-nx-cache
pnpm exec nx test  {domain}-event-handler-service --skip-nx-cache
```

Both must pass before moving on.

---

## Pattern B — Cross-Domain Events

Publisher and consumer are in different bounded contexts (e.g. `product-api-service` publishes → `order-event-handler-service` consumes).

### Phase B1 — Publishing-Side Contracts

In the **publishing** domain:

- Add event-type constants to domain constants.
- Add Zod event schemas to `packages/contracts/{publishing-domain}/src/event-schemas.ts` (`{publishingDomain}DomainEventSchema`, `{PublishingDomain}EventTypeEnum`, and the discriminated union type `{PublishingDomain}DomainEvent`).

### Phase B2 — Event Publisher

**Load skill:** `.claude/skills/sqs-event-publisher/SKILL.md`

Wire the publisher in the publishing API service.

### Phase B3 — Cross-Domain Consumer (use the generator)

**Critical rule:** The consumer imports from `@mma/contracts/{publishing-domain}` ONLY — never from `@mma/{publishing-domain}-domain`. The generator enforces this when `--crossDomain=true` is passed.

```bash
pnpm exec nx g @mma/nx-plugin:event-handler \
  --domain={consuming-domain} \
  --eventTypes={EVENT_ONE,EVENT_TWO} \
  --crossDomain=true \
  --sourceDomain={publishing-domain}
```

The generator emits handlers using `Extract<{PublishingDomain}DomainEvent, { eventType: 'X' }>` for type narrowing — **do NOT replace this with a direct `@mma/{publishing-domain}-domain` import.**

After scaffolding:

1. **Load skill:** `.claude/skills/cross-domain-event-handler/SKILL.md` for handler-body conventions.
2. Replace each TODO stub with calls to the **consuming** domain's own use cases. Handlers must write only to the consuming domain's repository.
3. Wire required use-case providers in `src/modules/{consuming-domain}.module.ts`.

### Phase B4 — Tests (mandatory)

Same as Phase A4 — one spec per handler. Mock the consuming domain's use cases.

### Phase B5 — Build gate

```bash
pnpm exec nx build {publishing}-api-service --skip-nx-cache
pnpm exec nx build {consuming}-event-handler-service --skip-nx-cache
pnpm exec nx test  {consuming}-event-handler-service --skip-nx-cache
```

---

## Pattern C — Choreography Saga

Multi-step async workflow with request→response event cycle across two domains.

### Phase C0 — Saga Design

**Load skill:** `.claude/skills/choreography-saga/SKILL.md`

Confirm and write down:

- **Initiator** domain + its provisional state (e.g. Order starts in `DRAFT`).
- **Responder** domain + its validation logic.
- **Success event** (e.g. `PRODUCT_VALIDATION_SUCCEEDED`).
- **Failure event** (e.g. `PRODUCT_VALIDATION_FAILED`).
- **Resolved states** in the initiator (e.g. `DRAFT → PENDING` on success, `DRAFT → VALIDATION_FAILED` on failure).
- **Idempotency strategy** — resolver handlers must check current status; if already resolved, catch the domain exception and skip (do not rethrow).

### Phase C1 — Initiator Side

1. Add provisional status to domain constants + entity state machine.
2. Create the use case that publishes the initiating event (publishing happens in the use case, not in the application service).
3. Wire the event publisher via `:service --publishesEvents=true` (or the `sqs-event-publisher` skill if the service already exists).
4. Add the initiating event schema to `packages/contracts/{initiator}/src/event-schemas.ts`.

### Phase C2 — Responder Side (cross-domain consumer)

Run the generator for the responder's event handler:

```bash
pnpm exec nx g @mma/nx-plugin:event-handler \
  --domain={responder} \
  --eventTypes={INITIATING_EVENT} \
  --crossDomain=true \
  --sourceDomain={initiator}
```

Then in the generated handler:

1. Validate using the responder's repository.
2. Publish a success or failure result event back to the initiator's queue (via an `IEventPublisher` provider — wire it in this service's module).
3. Add the result-event schema to `packages/contracts/{responder}/src/event-schemas.ts`.

### Phase C3 — Resolver (Initiator Event Handler)

If the initiator's event-handler service does not exist, scaffold it now with the generator (still `--crossDomain=true` because it consumes events from the responder):

```bash
pnpm exec nx g @mma/nx-plugin:event-handler \
  --domain={initiator} \
  --eventTypes={SUCCESS_EVENT,FAILURE_EVENT} \
  --crossDomain=true \
  --sourceDomain={responder}
```

In the resolver handlers:

1. Implement idempotent transitions — `ApproveValidationUseCase` and `FailValidationUseCase`.
2. Each handler must check current status first; if already resolved, catch the domain exception and skip.
3. Wire the use-case providers in the module.

### Phase C4 — Tests (mandatory)

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

Test:

- [ ] State transitions in the initiator entity.
- [ ] Validation logic in the responder use case.
- [ ] **Idempotency** — calling resolver handlers when the entity is already in a terminal state must NOT rethrow.
- [ ] Event handler dispatch routing.

### Phase C5 — Build gate

```bash
pnpm exec nx test  {initiator}-domain --skip-nx-cache
pnpm exec nx test  {responder}-domain --skip-nx-cache
pnpm exec nx build {initiator}-api-service --skip-nx-cache
pnpm exec nx build {responder}-event-handler-service --skip-nx-cache
pnpm exec nx build {initiator}-event-handler-service --skip-nx-cache
```

---

## Phase X — Post-Validate (parallel subagents)

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{event-handler-service}, ruleSet=event-handler")` — checks correlationId propagation, idempotency, cross-domain import isolation.
- `Agent(subagent_type="event-flow-tracer", prompt="eventType={EVENT_TYPE_PUBLISHED_OR_CONSUMED}")` — confirm the new wiring is correct end-to-end.

---

## Final Verification & Summary

After all phases pass, report:

- Event flow diagram (publisher → queue → consumer).
- Queue names and env-var names.
- Whether each handler is idempotent.
- Any TODOs left in the generated stubs (these MUST be removed before merging — every stub should call real use cases).

---

## Commit Convention (Generator-Driven PRs)

Split commits along the generator boundary so review stays tractable:

```bash
# Commit 1 — pure generator output (no business logic)
git commit -m "chore(scaffold): generate {domain} event handler via :event-handler generator

Generated by:
  nx g @mma/nx-plugin:event-handler --domain={domain} --eventTypes={...}"

# Commit 2 — hand-written handler logic
git commit -m "feat({domain}): wire event handlers to use cases"
```

Files marked `@generated` are auto-collapsed in PR diffs via `.gitattributes`.
**Never hand-edit them — re-run the generator instead.**
