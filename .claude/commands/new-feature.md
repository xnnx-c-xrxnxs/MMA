---
description: "Add a new feature to an existing domain — endpoint, use case, business rule, or query. USE WHEN user says 'add a feature', 'add an endpoint', 'add a use case', 'add business rule to', 'extend the ... domain', 'I want to add ... to the ... domain', or describes a new capability for user-domain, order-domain, or product-domain."
---

# New Feature — Guided Workflow

You are orchestrating the addition of a new feature to an existing domain. This workflow loads the correct skills per phase, skips inapplicable layers, and validates between phases.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase -1 — Draft PR Gate

Before any interview, verify the working context is ready for incremental commits. This unlocks per-push CI, lets subagents target the diff at any phase, and surfaces the work to teammates immediately.

1. Run `git branch --show-current`. If the answer is `develop` or `main`, stop and ask the developer to create a feature branch — never extend a domain on a shared branch.
2. Run `gh pr list --head {branch} --state open --json number,isDraft -q '.[0]'`. If no PR exists, open one now:

   ```
   gh pr create --draft --base develop --head {branch} \
     --title "feat({domain}): {short feature description}" \
     --body "Closes #<issue>\n\n**Orchestrator:** /new-feature\n**Spec:** none (existing-domain feature)\n\n_WIP — phases will commit incrementally._"
   ```

3. If the developer explicitly opts out ("trivial fix, no PR yet"), record the choice and continue — but warn that subagents and CI signals will be weaker.

From this point on, every phase ends with a `git add` + `git commit` + `git push` so CI runs continuously.

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **What is the new capability?** (e.g. "suspend a user", "list orders by customer", "apply a discount")
2. **Which domain?** (`user-domain`, `order-domain`, `product-domain`, or other)
3. **Which service?** (`user-api-service`, `order-api-service`, etc.)
4. **Does this change entity state?** (requires new entity method + guard + exception)
5. **Does this need a new query pattern?** (requires new repository method, possibly new GSI or index)
6. **Input fields and validation rules?** (required for contracts)
7. **Output shape — new or existing?** (does the response schema change?)
8. **Is this a collection endpoint?** (requires pagination — cursor for DynamoDB, offset for Prisma)
9. **Cross-service needs?**
   - Validate against another domain? (ACL — `sync-cross-service-call`)
   - Publish events? (`sqs-event-publisher`)
   - React to events? (`cross-domain-event-handler`)
10. **Frontend visibility?** Webapp, mobile, both, or backend-only?

### Auto-Detection

If the user names a domain, auto-detect:
- **Persistence:** user/product → DynamoDB, order → Prisma
- **Service:** `{domain}-api-service` unless stated otherwise
- **Pagination:** DynamoDB → cursor-based, Prisma → offset-based

**Do not proceed until questions 1–10 are answered.**

### Spec Summary (M1)

Before Phase 0.5, **echo the captured spec back** in a structured block so the user can correct anything before generation:

```
Feature:        {short title}
Domain:         {domain}
Service:        {service}
Entity changes: {yes — method `X`, exception `Y` / no}
New query:      {yes — by Z / no}
Input shape:    {fields with validation}
Output shape:   {new schema name / existing}
Pagination:     {cursor / offset / none}
Cross-service:  {ACL: ... / publishes: ... / consumes: ... / none}
Frontend:       {webapp / mobile / both / backend-only}
```

Ask: "Is this correct? (yes / amend X)". Loop until confirmed.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

After the interview, fan out **read-only** subagents in parallel before writing any code:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: add-contracts, domain-business-rules, new-use-case, dynamo-repository, prisma-repository, sync-cross-service-call, sqs-event-publisher, write-domain-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=all, thoroughness=medium")`
- If the contract is changing: `Agent(subagent_type="contract-diff-analyzer", prompt="domain={domain}, proposedChange={describe}")`

Wait for all to return. Summarize the current state of the domain, the contract impact, and confirm the plan with the user before moving on.

---

## Phase 1 — Domain Layer (if entity behavior changes)

> **Inside-out order:** Domain constants/entity must change BEFORE contracts — contracts re-export domain constants, and the application service later validates entity getters against contract schemas. Writing contracts first risks importing non-existent symbols.

**Skip this phase** if the feature is read-only (query, list) with no state changes.

**Load skill:** `.claude/skills/domain-business-rules/SKILL.md`

- **1a.** Update constants if a new status/role/type is added
- **1b.** Add entity method with guard condition
- **1c.** Add domain exception for the guard
- **1d.** Update barrel exports

**Validation gate:** Run `Bash` on `packages/{domain}-domain/src/domain/`.

---

## Phase 2 — Contracts

**Load skills:**
- `.claude/skills/add-contracts/SKILL.md`
- `.claude/skills/contracts-subpath-imports/SKILL.md` (M2 — mandatory if you add new files; enforces Golden Rule #11)

Add or update Zod schemas in `packages/contracts/{domain}/src/schemas.ts`:
- Input schema for the new operation
- Response schema (new or updated)
- Re-export any new domain constants added in Phase 1
- Update barrel exports in `packages/contracts/{domain}/src/index.ts`

**Validation gate:** Run `pnpm exec nx build contracts-{domain} --skip-nx-cache`.

---

## Phase 3 — Use Case

**Load skill:** `.claude/skills/new-use-case/SKILL.md`

Create the use case class with:
- Repository injection
- Entity lookup + not-found check
- Entity method call (if state change) or repository query (if read)
- Return domain entity

**If cross-service validation is needed (ACL):**
- Also load `.claude/skills/sync-cross-service-call/SKILL.md`
- Inject the ACL validator alongside the repository

**Validation gate:** Run `Bash` on `packages/{domain}-domain/src/application/use-cases/`.

---

## Phase 4 — Repository Interface (if new query pattern)

**Skip this phase** if no new repository method is needed.

Add the method signature to `packages/{domain}-domain/src/application/interfaces/{entity}-repository.interface.ts`.

- DynamoDB domains: use `IPaginatedResponse` for collections
- Prisma domains: use `IOffsetPaginatedResponse` for collections

---

## Phase 5 — Repository Implementation (if interface changed)

**Skip this phase** if Phase 4 was skipped.

**DynamoDB — load skill:** `.claude/skills/dynamo-repository/SKILL.md`
**Prisma — load skill:** `.claude/skills/prisma-repository/SKILL.md`

Implement the new method. If a new GSI is needed:
- Update the DynamoDB schema file
- Update `scripts/setup-localstack.ts`
- Run `pnpm run localstack:setup:force`

If Prisma schema changed:
- Run `pnpm prisma:{domain}:migrate:dev`

**Validation gate:** Run `Bash` on `packages/{domain}-domain/src/infrastructure/`.

---

## Phase 6 — Application Service

Update `apps/{domain}/{service}/src/application/services/{entity}-application.service.ts`:
- Add method for the new feature
- Inject the new use case into the constructor
- Transform entity → DTO using Zod schema parse
- **(H2)** Verify the file declares a module-level `const logger = createLogger('{service}')` from `@old-st/telemetry` — mandatory and lint-checked (Golden Rule #35 / `app-service-has-logger`). Never use `new Logger()` from `@nestjs/common`.

---

## Phase 7 — Controller + Swagger

**Load skills:**
- `.claude/skills/add-api-endpoints/SKILL.md`
- `.claude/skills/swagger-controller-docs/SKILL.md`
- `.claude/skills/current-user-decorator/SKILL.md` (H3 — mandatory for any endpoint that needs the authenticated actor; never read `userId`/`email` from `@Body()`/`@Query()`/`@Param()` per Golden Rule #45)
- `.claude/skills/gateway-jwt-auth/SKILL.md` (M3 — only if the new endpoint is `@Public()`; you must also register the route in `service-registry.json` → `gatewayAuth.publicRoutes`)

Add the new route with:
- Correct HTTP verb and path (REST conventions)
- `ZodValidationPipe` for input
- `@CurrentUser()` for actor identity (per Golden Rule #45)
- Full Swagger annotations (`@ApiOperation`, `@ApiParam`, `@ApiBody`, `@ApiResponse`, etc.)

---

## Phase 8 — Module Registration

Update `apps/{domain}/{service}/src/modules/{domain}.module.ts`:
- Register new use case as a factory provider
- If ACL is involved: add `HttpModule` import + ACL client provider

---

## Phase 9 — Exception Filter

**Load skill:** `.claude/skills/domain-exception-filter/SKILL.md`

Add any new domain/application exceptions to `DOMAIN_ERROR_MAP` in the service's `DomainExceptionFilter`.

**Validation gate:** Run `Bash` on the entire service directory. Fix all errors.

---

## Phase 10 — Tests

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

Write unit tests for:
- [ ] Entity method — happy path + each guard condition
- [ ] Use case — success + not-found + validation failures
- [ ] Application service — if orchestration logic was added (cursor routing, event publishing)

**Validation gate (M4 — mandatory):**

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache --coverage
pnpm exec nx test {service} --skip-nx-cache --coverage
```

Both must hit their thresholds (80% domain, 70% service). If either fails, add tests — do not move to the next phase.

---

## Phase 10b — API E2E (H4 — MANDATORY for any new endpoint)

**Skip only if** the feature added zero new endpoints (e.g. internal refactor, new business rule on existing endpoint already covered by an E2E spec).

**Load skills:**
- `.claude/skills/write-api-e2e-tests/SKILL.md`
- `.claude/skills/e2e-infrastructure/SKILL.md` (only if the feature requires a new E2E table/queue — most feature work reuses existing infra)

- [ ] Add at least one happy-path spec for the new endpoint to `apps/{domain}/{service}-e2e/src/`.
- [ ] Add at least one validation/error-path spec (404, 409, 400 as applicable).
- [ ] If the endpoint is state-changing, add a spec that asserts state transitioned correctly.
- [ ] Run `pnpm exec nx e2e {service}-e2e` once locally to confirm it passes.

Do not skip this phase — "E2E in a follow-up" is the most common source of unprotected backend changes landing on `develop`.

---

## Phase 11 — Webapp (if user-facing)

**Skip if backend-only.**

**Load skills:**
- `.claude/skills/webapp-api-client-hooks/SKILL.md`
- `.claude/skills/webapp-new-page/SKILL.md`
- `.claude/skills/webapp-form-with-validation/SKILL.md` (L2 — if the feature exposes a form, never duplicate Zod schemas; reuse the contract schemas added in Phase 2)
- `.claude/skills/webapp-toast-notifications/SKILL.md` (L2 — mandatory for any mutation; never use `alert()` or silent feedback)
- `.claude/skills/webapp-optimistic-mutations/SKILL.md` (L2 — only if the new mutation should feel instant: status toggles, like buttons, inline edits)

- **11a.** Add API client method in `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
- **11b.** Add React Query hook in `packages/client-common/src/hooks/use-{domain}.ts` (L1 — file is `use-{domain}.ts`, NOT `use-{domain}s.ts`)
- **11c.** Update webapp feature components in `apps/webapp/src/features/{domain}/` (use a per-domain barrel like `apps/webapp/src/features/{domain}/index.ts` for clean page imports). Use `apps/webapp/src/components/{domain}/` only for broadly reusable domain UI.
- **11d.** Update page orchestrator if new UI state is needed
- **11e.** Update `status-variants.ts` if a new status was added
- **11f.** If a new status enum value was added, update the per-domain label map in `packages/client-common/src/lib/status-labels/{domain}.ts` so `format{Domain}Status()` covers the new value (TS will error otherwise). See Golden Rule #22a + the `webapp-new-page` skill § Step 2a.

Balanced placement flow for 11c (mandatory):
- Start feature-local in `apps/webapp/src/features/{domain}/{feature-name}/...`.
- If the same UI pattern is used by 2+ routes/features in the same domain, promote it to `apps/webapp/src/components/{domain}/`.
- If a second feature is about to copy an existing feature-local component, promote first, then consume the shared version.

---

## Phase 12 — Mobile (if user-facing on mobile)

**Skip if backend-only or webapp-only.**

**Load skill:** `.claude/skills/mobile-new-screen/SKILL.md` or `.claude/skills/mobile-new-domain-feature/SKILL.md`

- **12a.** Update domain list component in `apps/mobile/src/components/{domain}/`
- **12b.** Update detail screen if action buttons changed
- **12c.** Update `status-variants.ts` if a new status was added
- **12d.** No mobile-side action needed for new status labels — mobile imports the same `format{Domain}Status()` helper from `@old-st/client-common` that webapp updated in 11f.

Steps 11a/11b (API client + hooks) are shared — skip if already done in Phase 11.

---

## Phase X — Post-Validate (parallel subagents)

After the build passes, fan out validators in parallel:

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{service}, ruleSet=http-service")`
- `Agent(subagent_type="e2e-impact-predictor", prompt="changedFiles={comma-separated list of files touched}")`

Address any reported violations before declaring the feature complete.

---

## Final Verification

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache --coverage
pnpm exec nx test {service} --skip-nx-cache --coverage
pnpm exec nx build {service} --skip-nx-cache
pnpm exec nx e2e {service}-e2e
```

Confirm:
- [ ] All unit tests pass with coverage thresholds met (80% domain, 70% service).
- [ ] E2E spec passes locally.
- [ ] Service builds cleanly.

**Summary:** Report what was created/modified — files, endpoints, new exceptions, env var changes, validator output, and any manual steps remaining.
