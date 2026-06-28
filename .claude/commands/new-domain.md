---
description: "Scaffold a complete new domain from scratch — domain package, contracts, microservice, infrastructure, and use cases. Powered by the @mma/nx-plugin:domain generator. USE WHEN user says 'add a domain', 'create a new domain', 'new bounded context', 'scaffold a domain', 'new entity from scratch', or describes a brand-new capability that doesn't map to an existing domain."
---

# New Domain — Guided Workflow

You are orchestrating the creation of a complete new bounded context. The heavy
lifting (file generation, registry updates, port allocation, LocalStack wiring,
service composition) is delegated to **`@mma/nx-plugin:domain`**. Your job is
to:

1. Run a structured interview to collect the spec.
2. Preview the file plan with `--dryRun`.
3. Get user confirmation.
4. Run the generator for real.
5. Drive AI-side refinement of business rules, contracts, and tests using the
   generated **`TODO.md`** as the authoritative checklist.

**Do NOT call the generator until Phase 0 is complete.**

---

## Phase -1 — Draft PR Gate

Before any interview, verify the working context is ready for incremental commits. This unlocks per-push CI, lets subagents target the diff at any phase, and surfaces the work to teammates immediately.

1. Run `git branch --show-current`. If the answer is `develop` or `main`, stop and ask the developer to create a feature branch (e.g. `feat/{domain}-domain`) — never scaffold a domain on a shared branch.
2. Run `gh pr list --head {branch} --state open --json number,isDraft -q '.[0]'`. If no PR exists, open one now:

   ```
   gh pr create --draft --base develop --head {branch} \
     --title "feat({domain}): scaffold domain" \
     --body "Closes #<issue>\n\n**Orchestrator:** /new-domain\n**Spec:** .specs/domain-{domain}.yaml (will be committed in Phase 1)\n\n_WIP — phases will commit incrementally._"
   ```

3. If the developer explicitly opts out ("experimental, no PR yet"), record the choice and continue — but warn that subagents and CI signals will be weaker.

From this point on, every phase ends with a `git add` + `git commit` + `git push` so CI runs continuously. The spec YAML is always committed FIRST so reviewers see the contract before the implementation diff.

---

## Phase 0 — Source Selection

Before any interview questions, ask the user how they want to provide the domain spec:

```
How would you like to define the domain spec?

  A. I have a spec YAML file → paste the path
     (e.g. .specs/domain-invoice.yaml)
  B. Generate a template, I'll edit it, then resume
     → run /new-domain-spec, then re-run /new-domain with the path
  C. Interview me inline (current flow — best for 1–3 fields)
```

**Branching:**

- **A — Spec file provided:**
  - **Load skill:** `.claude/skills/parse-domain-spec/SKILL.md`
  - Run the skill with the provided path. It validates against `.specs/schemas/domain-spec.schema.json` and produces the same Spec Summary block that the inline interview would.
  - Skip the inline questions in this section. Confirm the loaded spec, then jump straight to Phase 0.5.
- **B — Generate template:**
  - Tell the user: "Run `/new-domain-spec` now to generate a template. Edit it, then re-run `/new-domain` and pick option A with the path."
  - **Stop this run.**
- **C — Inline interview:**
  - Continue with the standard interview below.

---

## Phase 0 — Interview (Path C only)

Ask the user **all** of the following in a single structured message and wait
for answers. Use `vscode_askQuestions` if helpful.

### Required Information

1. **Domain name** — singular lowercase kebab-case (e.g. `shipping`, `payment`, `notification`).
2. **Entity name** — primary entity. Defaults to the domain name; ask only if the user wants them to differ (e.g. domain `shipping`, entity `shipment`).
3. **Fields** — ALL entity attributes as `name:type[?]` comma-separated. Allowed types: `string`, `number`, `boolean`, `date`. A trailing `?` marks the field optional.

   > Example: `orderId:string,trackingNumber:string,carrier:string,weight:number,address:string,estimatedDelivery:date?`

4. **Statuses** — comma-separated CONSTANT_CASE list (e.g. `PENDING,IN_TRANSIT,DELIVERED,CANCELLED,FAILED`). Required if the entity has lifecycle. If the entity is stateless, accept "none" — the generator skips the status enum + GSI1.
5. **Use cases to scaffold** — comma-separated subset of `create,get-by-id,update,delete,list`. Default if user is unsure: `create,get-by-id,list`.
6. **Persistence** — `dynamodb` (currently the only supported value; Prisma path is on the roadmap).
7. **Business rules** — state transitions, guards, invariants the user wants enforced (e.g. "cannot cancel if DELIVERED", "weight must be > 0"). Capture verbatim — the generator emits placeholders, AI fills them in Phase 3.
8. **Cross-service communication** — does this domain need to call another domain (ACL), publish events, or react to events? Capture but defer to Phase 7. **If the user says "publishes events" or "emits events to SQS", note this — it sets `--publishesEvents=true` in Phase 1 and Phase 2.**
9. **Frontend visibility** — webapp, mobile, both, or neither. Defer to Phase 8.

**Do not proceed until questions 1–7 are answered.** Questions 8 and 9 can be deferred.

### Spec Summary (M1)

Before moving to Phase 0.5, **echo the captured spec back to the user in a structured block** so they can correct anything before generation:

```
Domain:        {domain}
Entity:        {entity}
Fields:        {fields}
Statuses:      {statuses or 'none'}
Use cases:     {useCases}
Persistence:   {persistence}
Business rules captured:
  - {rule 1}
  - {rule 2}
  ...
Publishes events: {yes/no}
Frontend:      {webapp/mobile/both/none}
```

Ask: "Is this correct? (yes / amend X)". Loop until confirmed.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

Before generating files, fan out read-only subagents in parallel:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: new-domain-package, new-domain-entity, domain-business-rules, new-dynamo-schema, new-prisma-schema, dynamo-repository, prisma-repository, nestjs-service-layers, write-domain-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain={similar-existing-domain like order or user}, thoroughness=medium")` — finds the closest existing pattern to model the new domain on.
- `Agent(subagent_type="port-claim-checker", prompt="mode=next-port, newServiceName={domain}")`

Use the digest + similar-domain summary + suggested port when running the generator in Phase 1.

---

## Phase 1 — Dry-run preview

Run the generator in `--dryRun` mode and show the full file plan to the user:

```bash
pnpm nx g @mma/nx-plugin:domain \
  --name={domain} \
  --entity={entity} \
  --fields="{fields}" \
  --statuses="{statuses}" \
  --useCases="{useCases}" \
  --publishesEvents={true|false} \
  --dryRun
```

Set `--publishesEvents=true` only if Phase 0 question 8 indicates this service publishes events. If false (the default), the generator skips SQS env vars in `.env.local.example` and `service-registry.json` — they would otherwise be dead config for a service with no event publisher.

The generator prints every file it WOULD create plus every workspace file it
would update (`tsconfig.base.json`, `.github/service-registry.json`,
`scripts/setup-localstack.ts`, `.env.local.example`, `.vscode/tasks.json`).

Surface the plan and ask: **"Proceed with generation? (yes / refine spec / cancel)"**

If the user wants to refine, loop back to Phase 0 with their changes.

---

## Phase 2 — Generate

Run the same command **without** `--dryRun`:

```bash
pnpm nx g @mma/nx-plugin:domain \
  --name={domain} \
  --entity={entity} \
  --fields="{fields}" \
  --statuses="{statuses}" \
  --useCases="{useCases}" \
  --publishesEvents={true|false}
```

After the generator finishes:

- [ ] Confirm `packages/{domain}-domain/TODO.md` was created.
- [ ] Run `pnpm install` to relink the new workspace package.
- [ ] Run `Bash` on `packages/{domain}-domain/src/` and `apps/{domain}/{domain}-api-service/src/`. The skeleton compiles by default — only TODO blocks should remain.

If the generator throws because the domain or contracts package already exists,
ask the user how to proceed (rename, delete the existing tree, or abort) — the
generator never overwrites.

---

## Phase 3 — Business rules (entity)

Now AI fills in the business logic. Open the generated entity at
`packages/{domain}-domain/src/domain/entities/{entity}.entity.ts`.

**Load skills:**
- `.claude/skills/domain-business-rules/SKILL.md`
- `.claude/skills/new-domain-entity/SKILL.md` (only if you need to add fields the user forgot)

Apply every rule captured in Phase 0 question 7:

- [ ] Add validation in `create()` (range checks, required-when-status checks, etc.).
- [ ] For each status transition the user mentioned, add a method (e.g. `dispatch()`, `markDelivered()`, `cancel()`) that:
  - guards the current status,
  - throws a typed domain exception when the transition is illegal,
  - updates `{entity}Status` and `updatedAt`.
- [ ] Add new exception classes under `src/domain/exceptions/` and export them from `exceptions/index.ts`.
- [ ] Replace the placeholder spec cases for every method you added.

**Validation gate:** Run `pnpm exec nx test {domain}-domain --skip-nx-cache`. Fix any failing tests before moving on.

---

## Phase 4 — Action use cases

For every state-transition method added in Phase 3, you **MUST** run the
use-case generator. Do NOT hand-write action use cases — the generator wires
the repository, persists, exports the use case from the barrel, and emits a
spec stub. Hand-written action files have produced PRs missing spec files in
the past.

```bash
pnpm nx g @mma/nx-plugin:use-case \
  --domain={domain} \
  --entity={entity} \
  --verb={verb} \
  --type=action
```

Use `--actionMethod={methodName}` if the entity method name differs from the
verb (e.g. `--verb=mark-completed --actionMethod=markAsCompleted`).

Repeat for **each** transition. After the final run, verify:

```powershell
Get-ChildItem packages/{domain}-domain/src/application/use-cases -Recurse -Filter "*.use-case.spec.ts" | Measure-Object
```

The spec count must equal the use-case count. If any are missing, the action
use case was hand-written — delete it and re-run the generator.

**Validation gate (H2):** Run `pnpm exec nx test {domain}-domain --skip-nx-cache`. The freshly generated use-case spec stubs must compile and pass before moving on — catching wiring errors here keeps Phase 5 / Phase 6 debugging focused on a single layer.

---

## Phase 5 — Contracts refinement

**Load skills:**
- `.claude/skills/add-contracts/SKILL.md`
- `.claude/skills/contracts-subpath-imports/SKILL.md` (M2 — mandatory if you add new files to `packages/contracts/{domain}/`; enforces Golden Rule #11)

Open `packages/contracts/{domain}/src/schemas.ts`. The generator emits Zod
schemas with permissive defaults. Apply real constraints:

- [ ] String fields: `.min()`, `.max()`, regex where applicable.
- [ ] Numeric fields: `.int()`, `.positive()`, `.min()`, `.max()`.
- [ ] Date fields: switch from `z.string()` to `z.iso.datetime()`.
- [ ] Add request schemas for action endpoints (`{verb}{Entity}RequestSchema`) and any extra response variants.

**Validation gate (H3):** Run `pnpm exec nx build contracts-{domain} --skip-nx-cache`. Tightening Zod constraints can break downstream `schema.parse()` calls in the application service — catching it here is much cheaper than mixing it with controller debugging in Phase 6.

---

## Phase 6 — Service wiring

Open `apps/{domain}/{domain}-api-service/src/modules/{entity}.module.ts`. The
service generator emits commented-out provider blocks. Uncomment + complete:

- [ ] Add a `useFactory` provider for **every** generated use case, all
      injecting `{DOMAIN_PLURAL}_REPOSITORY`.
- [ ] Replace the `ping` method in
      `application/services/{entity}-application.service.ts` with real public
      methods that orchestrate the use cases and return DTOs via the contracts
      schemas (`schema.parse(...)`).
- [ ] **(M4)** Verify the application service declares a module-level singleton `const logger = createLogger('{domain}-api-service')` from `@mma/telemetry` — this is mandatory and lint-checked (Golden Rule #35 / `app-service-has-logger`). Never use `new Logger()` from `@nestjs/common`.
- [ ] Replace the placeholder `GET /ping` controller with real REST routes —
      load `.claude/skills/add-api-endpoints/SKILL.md` and
      `.claude/skills/swagger-controller-docs/SKILL.md`.
- [ ] **(M3)** For any endpoint that needs the authenticated actor (audit logs, ownership checks, mutations recording `createdBy`), load `.claude/skills/current-user-decorator/SKILL.md` and use `@CurrentUser()` — never read `userId`/`email` from `@Body()`/`@Query()`/`@Param()` (Golden Rule #45, lint-checked by `no-userId-in-controller-input`).
- [ ] Extend `presentation/filters/domain-exception.filter.ts` `DOMAIN_ERROR_MAP`
      with every domain exception you added — load
      `.claude/skills/domain-exception-filter/SKILL.md`.
- [ ] If any controller endpoint is unauthenticated (rare for new domains),
      decorate with `@Public()` and add the route to
      `.github/service-registry.json` → `gatewayAuth.publicRoutes` — load
      `.claude/skills/gateway-jwt-auth/SKILL.md`.

**Validation gate:** Run `pnpm exec nx build {domain}-api-service --skip-nx-cache`. Fix all errors.

---

## Phase 7 — Cross-service / async (if applicable)

Only execute if Phase 0 question 8 indicated cross-service needs.

| Need | Skill |
|---|---|
| Synchronous validation against another domain | `.claude/skills/sync-cross-service-call/SKILL.md` |
| Publish events to SQS | `.claude/skills/sqs-event-publisher/SKILL.md` |
| React to intra-domain events | `.claude/skills/sqs-event-driven-service/SKILL.md` |
| React to cross-domain events | `.claude/skills/cross-domain-event-handler/SKILL.md` |
| Multi-step async workflow | `.claude/skills/choreography-saga/SKILL.md` |

---

## Phase 8 — Frontend (if applicable)

Only execute if Phase 0 question 9 indicated frontend visibility.

- **Webapp:** load `.claude/skills/webapp-api-client-hooks/SKILL.md` then `.claude/skills/webapp-new-page/SKILL.md`.
- **Mobile:** load `.claude/skills/mobile-new-screen/SKILL.md`.

**Status display helper (Golden Rule #22a — REQUIRED if entity has a status enum):**

If the entity has a `status` field (or any `*Status` enum), generate the per-domain label helper at `packages/client-common/src/lib/status-labels/{domain}.ts`:

- Use the `labels:` map from the YAML spec (if provided) — keys MUST be a subset of the enum's `values`. Any value not listed falls through to Title Case via the shared `formatStatus()` utility.
- If the YAML has no `labels:` block, scaffold the file with default Title Case labels for every enum value (the developer can edit afterwards). The map MUST be exhaustive — `Readonly<Record<{Entity}Status, string>>`.
- Re-export `format{Entity}Status` from `packages/client-common/src/lib/status-labels/index.ts` AND from the package's `src/index.ts` barrel.
- Both webapp and mobile components import the same helper — no platform fork.
- Wrap every JSX status render as `{format{Entity}Status({entity}.status)}`. The `no-raw-status-in-jsx` lint check will fail the PR otherwise.

See the `webapp-new-page` skill § Step 2a for the file template.

---

## Phase 9 — Tests (MANDATORY)

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

This phase is mandatory — the generator emits 1-line constructibility stubs
that will not satisfy the 80% domain coverage threshold. **Do not declare the
domain done until coverage passes.**

Replace the placeholders with real cases:

- [ ] Entity (`{entity}.entity.spec.ts`): `create()`, `reconstitute()`, every business method, every guard, every exception path.
- [ ] Each use case (`*.use-case.spec.ts`): happy path + each error branch + (if applicable) idempotency / cross-service mocks.
- [ ] Application service (`{entity}-application.service.spec.ts`): DTO transformation, cursor routing, all public methods.

**Validation gate (mandatory):**

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache --coverage
pnpm exec nx test {domain}-api-service --skip-nx-cache --coverage
```

Both must hit their thresholds (80% domain, 70% service). If either fails,
go back and add tests — do not move to the next phase.

---

## Phase 9b — API E2E project (MANDATORY)

**Load skills:** `.claude/skills/write-api-e2e-tests/SKILL.md` then `.claude/skills/e2e-infrastructure/SKILL.md`

A new HTTP API service ALWAYS gets a paired `-e2e` project:

- [ ] Create `apps/{domain}/{domain}-api-service-e2e/` following `write-api-e2e-tests`.
- [ ] Update `scripts/setup-e2e.ts` and `scripts/teardown-e2e.ts` with the domain's E2E table (and queue if `publishesEvents=true`) per `e2e-infrastructure`.
- [ ] Add at least one CRUD spec covering the happy path and one validation/error case.
- [ ] Run `pnpm exec nx e2e {domain}-api-service-e2e` once locally to confirm it passes.

Do not skip this phase — "API E2E to be added in a follow-up" is the most
common source of unprotected backend changes landing on `develop`.

---

## Phase 10 — Local startup

```bash
pnpm run localstack:setup:force      # picks up the new table from the registry
pnpm nx serve {domain}-api-service   # starts on the auto-claimed port
```

Hit `http://localhost:{PORT}/api/health` — should return `{ status: "ok", service: "{domain}-api-service" }`.

---

## Phase X — Post-Validate (parallel subagents)

Before final verification, fan out validators in parallel:

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{domain}-api-service, ruleSet=http-service")`
- `Agent(subagent_type="port-claim-checker", prompt="mode=audit")` — confirm port registry is consistent.
- `Agent(subagent_type="test-coverage-analyzer", prompt="project={domain}-domain")` — surface any gaps before the coverage gate.

Fix any reported issues before merging.

---

## Final Verification

```bash
pnpm exec nx run-many -t test build --projects={domain}-domain,{domain}-api-service --skip-nx-cache
pnpm exec nx e2e {domain}-api-service-e2e
```

Confirm:
- [ ] All tests pass with coverage thresholds met (80% domain, 70% service).
- [ ] E2E spec passes locally.
- [ ] Service builds cleanly.
- [ ] `TODO.md` is fully checked off (or remaining items are agreed deferred work).
- [ ] `.env.local` was updated (the generator updates `.env.local.example`; copy missing keys with the `generate-env-local` skill).

## Pull Request — Accuracy Rules

When creating the PR, **read the actual diff** before checking off the
pre-flight checklist. Common mistakes to avoid:

1. **API E2E** — if this PR adds a new backend service, NEVER tick "Not
   applicable (no backend changes)". Tick "Specs added/updated".
2. **`.env.local.example`** — run `git diff develop -- .env.local.example`. If
   it shows additions, the box is done; do not list it as "follow-up needed".
3. **`.vscode/tasks.json`** — run `git diff develop -- .vscode/tasks.json`. If
   `Service: Serve {domain}-api-service` is in the diff, the box is done.
4. **SQS env vars** — only mention them if `publishesEvents=true` was passed
   to the generator. Otherwise they are not part of this domain's surface.

**Summary:** Report what was created — files, endpoints, env vars, port number, and any deferred items.

---

## Commit Convention (Generator-Driven PRs)

To make code review tractable, split commits along the generator boundary:

```bash
# Commit 1 — pure generator output (no business logic)
git add -A
git commit -m "chore(scaffold): generate {domain} domain via :domain and :service generators

Generated by:
  nx g @mma/nx-plugin:domain --name={domain} --persistence={dynamo|prisma}
  nx g @mma/nx-plugin:service --domain={domain}"

# Commit 2 — hand-written business logic on top of the scaffold
git add -A
git commit -m "feat({domain}): add entity invariants, use cases, repository, and E2E"
```

Reviewers can then approve commit 1 by re-running the generators (zero diff
expected) and focus their attention on commit 2 — the actual business logic.

The `.gitattributes` file already marks generator output as
`linguist-generated=true`, so GitHub auto-collapses it in the PR diff. Files
also carry an `@generated` JSDoc header. **Never hand-edit those files —
re-run the generator instead.**
