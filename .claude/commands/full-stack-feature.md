---
description: "Add a full-stack feature across backend, webapp, and mobile. USE WHEN user says 'full-stack feature', 'add ... to backend and frontend', 'add ... end to end', 'backend + webapp', 'backend + mobile', 'I want this on the API and the UI', or describes a capability that must be visible across multiple layers."
---

# Full-Stack Feature — Guided Workflow

You are orchestrating the addition of a feature that spans the backend (domain + API service) and one or both frontends (webapp, mobile). This workflow ensures each layer is built in the correct order with proper validation between phases.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase -1 — Draft PR Gate

Full-stack features touch backend + webapp + mobile, so the draft PR is non-negotiable — without it the slice is invisible to teammates and CI cannot guard the contract between layers.

1. Run `git branch --show-current`. If the answer is `develop` or `main`, stop and ask the developer to create a feature branch (e.g. `feat/{domain}-{feature}`).
2. Run `gh pr list --head {branch} --state open --json number,isDraft -q '.[0]'`. If no PR exists, open one now:

   ```
   gh pr create --draft --base develop --head {branch} \
     --title "feat({domain}): {feature description} (full-stack)" \
     --body "Closes #<issue>\n\n**Orchestrator:** /full-stack-feature\n**Spec:** .specs/page-{slug}.yaml (if applicable)\n\n_WIP — backend phase commits first, then webapp + mobile in parallel._"
   ```

3. Backend phase commits + pushes BEFORE the parallel webapp-builder / mobile-builder subagents run — they need the contracts package on the remote so `contract-diff-analyzer` can compare against the published types.

From this point on, every phase ends with a `git add` + `git commit` + `git push`.

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

#### Backend
1. **What is the new capability?** (e.g. "suspend a user", "add discount to orders")
2. **Which domain?** (`user-domain`, `order-domain`, `product-domain`, or other)
3. **Which service?** (`user-api-service`, `order-api-service`, etc.)
4. **Does this change entity state?** (new business rule, status, guard)
5. **Does this need a new query pattern?** (new repository method, GSI, or index)
6. **Input fields and validation rules?**
7. **Output shape — new or existing?**
8. **Cross-service needs?** (ACL, event publishing, event consuming)

#### Frontend
9. **Which frontends?** Webapp only, mobile only, or both?
10. **What UI is needed?**
    - New table column?
    - New action button (conditional on entity status)?
    - New form (create/edit)?
    - New page/screen?
    - New detail view field?
11. **Does a new status need a badge variant?**

**Do not proceed until all questions are answered.**

### Spec Summary (H2)

Before Phase 0.5, **echo the captured spec back** in a structured block so the user can correct anything before the parallel subagent fan-out:

```
Feature:        {short title}
Backend:
  Domain:        {domain}
  Service:       {service}
  Entity changes: {yes — method `X`, exception `Y` / no}
  New query:      {yes — by Z / no}
  Input shape:    {fields with validation}
  Output shape:   {new schema name / existing}
  Cross-service:  {ACL: ... / publishes: ... / consumes: ... / none}
Frontend:
  Targets:       {webapp / mobile / both}
  Webapp UI:     {bullet list of components / pages / forms}
  Mobile UI:     {bullet list of screens / components}
  New status:    {variant mapping or 'none'}
```

Ask: "Is this correct? (yes / amend X)". Loop until confirmed.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

After the interview is complete, fan out **read-only** subagents in parallel before writing any code:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: add-contracts, domain-business-rules, new-use-case, dynamo-repository (or prisma-repository), webapp-api-client-hooks, webapp-new-page, mobile-new-screen, write-domain-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=all, thoroughness=medium")`
- If contract is changing: `Agent(subagent_type="contract-diff-analyzer", prompt="domain={domain}, proposedChange={describe the new fields/schemas}")`

Wait for all to return, then summarize for the user:
- Current state of the domain (from domain-explorer)
- Whether the contract change is breaking (from contract-diff-analyzer)
- Confirm plan before proceeding

---

## Phases 1–9 — Backend

Execute the backend phases exactly as defined in the **New Feature** workflow (`.claude/commands/new-feature.md`):

| Phase | Scope | Skill(s) |
|---|---|---|
| 1 | Domain layer (constants, entity, exception) | `domain-business-rules` (if state change) |
| 2 | Contracts | `add-contracts` + `contracts-subpath-imports` |
| 3 | Use case | `new-use-case` + optionally `sync-cross-service-call` |
| 4 | Repository interface | (if new query) |
| 5 | Repository implementation | `dynamo-repository` or `prisma-repository` |
| 6 | Application service (with `createLogger()` per Golden Rule #35) | — |
| 7 | Controller + Swagger + `@CurrentUser()` | `add-api-endpoints` + `swagger-controller-docs` + `current-user-decorator` + (if `@Public()`) `gateway-jwt-auth` |
| 8 | Module registration | — |
| 9 | Exception filter | `domain-exception-filter` |

> **H1 — Inside-out order:** Domain (Phase 1) MUST come before Contracts (Phase 2) — contracts re-export domain constants. Do not invert.

**Validation gate after Phase 9:** Run `Bash` on the entire service directory. Fix all errors before proceeding to backend tests.

---

## Phase 10 — Backend Tests

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

Write unit tests for:
- Entity method (if new)
- Use case (happy path + error paths)
- Application service (if orchestration logic changed)

**Validation gate (M1 — mandatory):**

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache --coverage
pnpm exec nx test {service} --skip-nx-cache --coverage
```

Both must hit thresholds (80% domain, 70% service).

---

## Phase 10b — API E2E (H3 — mandatory if any new endpoint)

**Skip only if** the feature added zero new endpoints.

**Load skill:** `.claude/skills/write-api-e2e-tests/SKILL.md`

- [ ] Add at least one happy-path spec for the new endpoint to `apps/{domain}/{service}-e2e/src/`.
- [ ] Add at least one error-path spec.
- [ ] Run `pnpm exec nx e2e {service}-e2e` once locally to confirm.

---

## Phase 11 — Shared Data-Access Layer

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

This phase is shared by both webapp and mobile — do it once. The main agent owns this phase (NOT the parallel builders) so both builders can consume the same hook.

- **11a.** Add API client method in `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
  - Must pass Zod `schema` option for response validation
- **11b.** Add React Query hook in `packages/client-common/src/hooks/use-{domain}.ts` (H5 — file is `use-{domain}.ts`, NOT `use-{domain}s.ts`)
  - Query hook (for reads) or mutation hook (for writes)
  - Mutations invalidate the domain query key on success
  - Export from `packages/client-common/src/hooks/index.ts`

**Validation gate:** Run `Bash` on `packages/client-common/src/`.

---

## Phase 12+13 — Frontend Slices (PARALLEL FAN-OUT)

The webapp slice and mobile slice are independent — both consume the same hook from Phase 11. Run them in **parallel subagents** to halve wall-clock time.

### Decision

- **Webapp + mobile both in scope:** spawn `webapp-builder` and `mobile-builder` IN PARALLEL (single batch of `Agent` calls).
- **Webapp only:** spawn just `webapp-builder`.
- **Mobile only:** spawn just `mobile-builder`.
- **Neither (backend-only):** skip this phase entirely.

### Spawning the Builders

Both builders need the same input contract. Provide ALL of:

- `feature` — the capability description
- `domain` — `{domain}`
- `contract` — exact name of new/updated Zod schema(s) added in Phase 1
- `apiClient` — name of the new method on `{domain}-api.client.ts` (added in Phase 11a)
- `hookSpec` — name of the new React Query hook (added in Phase 11b)
- `uiChanges` — bullet list of UI changes for that platform
- `statusVariants` — if new entity status, the variant mapping
- `statusLabels` — if new entity status, the per-value display labels for `format{Domain}Status()` (Golden Rule #22a). Defaults to Title Case via `formatStatus()`; only list overrides for acronyms / branded terms / values where Title Case is wrong.

Example parallel invocation:

```
Agent(subagent_type="webapp-builder", prompt="
  feature: Add discount code to order checkout
  domain: order
  contract: orderRequestSchema (added discountCode?: string), orderResponseSchema (added discountCode?)
  apiClient: orderApi.createOrder accepts discountCode
  hookSpec: useCreateOrder mutation already accepts new field
  uiChanges:
    - Add 'Discount Code' input field to create-order-form
    - Add 'discount' column to order-table.tsx
    - Add data-testid='discount-code-input'
  statusVariants: none
")

Agent(subagent_type="mobile-builder", prompt="
  feature: Add discount code to order checkout
  domain: order
  contract: orderRequestSchema, orderResponseSchema
  hookName: useCreateOrder
  uiChanges:
    - Add 'Discount Code' Input to mobile create-order screen
    - Show discountCode line in order detail screen if present
  statusVariants: none
")
```

## Phase 14 — Validation Fan-Out (PARALLEL)

After both builders return, fan out a final batch of read-only validators in a single `Agent` block:

- `Agent(subagent_type="golden-rule-validator", prompt="scope=changed files vs base branch")`
- `Agent(subagent_type="dependency-auditor", prompt="scope=packages/{domain}-domain/**,apps/{domain}/**,apps/webapp/**,apps/mobile/**")`
- `Agent(subagent_type="test-coverage-analyzer", prompt="projects={domain}-domain,{domain}-api-service,webapp,mobile,client-common")`
- **Only if the diff touches `apps/auth/**`, `presentation/controllers/**`, `infrastructure/clients/**`, JWT/secrets/cookies, or any cross-service ACL adapter:** `Agent(subagent_type="security-reviewer", prompt="scope=changed files vs base branch, focus=all")`

Wait for all to return. Pass every output as one block to `result-aggregator`:

- `Agent(subagent_type="result-aggregator", prompt="workflow=/full-stack-feature, mode=gate, inputs=<concatenated reports>")`

If the aggregator reports `FAIL`, STOP and surface blocking issues to the developer. Do not proceed to Phase 15.

## Phase 15 — PR Description

If the aggregator reports `PASS` or `WARN`:

- `Agent(subagent_type="pr-summary-writer", prompt="workflow=/full-stack-feature, aggregatorReport=<phase 14 output>, linkedIssue={if known}")`

Take the returned Markdown and offer it to the developer with:

> Run `gh pr edit --body-file -` to update the draft PR description, or copy/paste it manually.

The orchestrator never calls `gh pr edit` itself — the developer owns the publish action.

### Why Parallel?

Webapp-builder and mobile-builder write to disjoint paths (`apps/webapp/`, `packages/ui/` vs `apps/mobile/`, `packages/mobile-ui/`). They cannot collide. Running them in parallel eliminates sequential wait time and keeps main-agent context clean.

### Webapp Builder — Skills to load (M2)

The webapp-builder MUST consume these skills as part of its prompt context:
- `.claude/skills/webapp-new-page/SKILL.md`
- `.claude/skills/webapp-form-with-validation/SKILL.md` (M2 — forms reuse contract Zod schemas)
- `.claude/skills/webapp-toast-notifications/SKILL.md` (M2 — mutations always surface success/error toasts)
- `.claude/skills/webapp-optimistic-mutations/SKILL.md` (M2 — only for instant-feel mutations)
- `.claude/skills/webapp-error-boundaries/SKILL.md` (if a new route segment is added)

### Mobile Builder — Skills to load

- `.claude/skills/mobile-new-screen/SKILL.md` or `.claude/skills/mobile-new-domain-feature/SKILL.md`

---

## Phase 14 — Frontend Tests

**For webapp — load skill:** `.claude/skills/write-webapp-tests/SKILL.md`
**For mobile — load skill:** `.claude/skills/write-mobile-tests/SKILL.md`
**For shared hooks — load skill:** `.claude/skills/write-client-common-tests/SKILL.md`

Write tests for:
- [ ] API client method — mock `fetch`, verify URL, method, body, Zod parsing
- [ ] React Query hook — `renderHook` with `QueryClientProvider`
- [ ] Domain components — conditional rendering (status-based buttons, table rows, badges)

**Validation gate (M1 — mandatory):**

```bash
pnpm exec nx test client-common --skip-nx-cache --coverage
pnpm exec nx test webapp --skip-nx-cache --coverage     # if webapp in scope
pnpm exec nx test mobile --skip-nx-cache --coverage     # if mobile in scope
```

All must hit 70% coverage threshold.

---

## Phase 14b — Webapp E2E (H4 — mandatory if webapp in scope)

**Load skill:** `.claude/skills/write-webapp-e2e-tests/SKILL.md`

- [ ] Add Playwright spec(s) for the new flow in `apps/webapp-e2e/src/specs/{domain}/`.
- [ ] Add `data-testid` attributes to any new components per `apps/webapp-e2e/src/utils/selectors.ts` conventions.
- [ ] Run `pnpm exec nx e2e webapp-e2e --grep {feature-name}` once locally to confirm.

---

## Phase 15 — Post-Validate (parallel subagents)

After all builds pass, fan out validators in parallel:

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**,packages/client-common/**,apps/webapp/**,apps/mobile/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{service}, ruleSet=http-service")`
- `Agent(subagent_type="e2e-impact-predictor", prompt="changedFiles={comma-separated list of files touched in this workflow}")`

If any validator reports failures, address them before merging.

---

## Final Verification

```bash
# Backend
pnpm exec nx test {domain}-domain --skip-nx-cache --coverage
pnpm exec nx test {service} --skip-nx-cache --coverage
pnpm exec nx build {service} --skip-nx-cache
pnpm exec nx e2e {service}-e2e

# Frontend (run only the slices in scope)
pnpm exec nx test client-common --skip-nx-cache --coverage
pnpm exec nx test webapp --skip-nx-cache --coverage
pnpm exec nx build webapp --skip-nx-cache
pnpm exec nx e2e webapp-e2e
pnpm exec nx test mobile --skip-nx-cache --coverage
```

Confirm:
- [ ] All unit tests pass with coverage thresholds met (80% domain, 70% everywhere else).
- [ ] API E2E spec(s) pass.
- [ ] Webapp E2E spec(s) pass (if webapp in scope).
- [ ] All affected projects build cleanly.
- [ ] Lint check passes: `pnpm exec ts-node --project scripts/tsconfig.json scripts/lint-standards.ts`.

**Summary:** Report the full vertical slice — backend files, shared hooks, webapp components, mobile components, tests, validator output, and any manual steps remaining.
