---
description: "Add E2E tests for a domain — API E2E (Jest + axios), webapp E2E (Playwright), or both. USE WHEN user says 'add e2e tests', 'e2e for my domain', 'playwright tests for', 'write e2e', 'api e2e tests', or describes end-to-end testing needs for any domain."
---

# New E2E Tests — Guided Workflow

You are orchestrating the addition of E2E tests for a domain. This workflow loads the correct skills per phase, validates between phases, and ensures infrastructure is properly wired.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Which domain?** (`user-domain`, `order-domain`, `product-domain`, or other)
2. **Which types of E2E tests?**
   - API E2E (Jest + axios against running backend service)
   - Webapp E2E (Playwright against running Next.js app)
   - Both
3. **Does the E2E infrastructure already exist for this domain?** (Check `scripts/setup-e2e.ts` for existing table/DB/queue configs)
4. **Are data-testid attributes already on the webapp components?** (Only needed for webapp E2E)
5. **What are the critical user flows to test?** (e.g., CRUD, status transitions, filtering, cross-domain workflows)
6. **Does this domain depend on other domains?** (e.g., orders need users + products seeded first)

### Auto-Detection

- Check `scripts/setup-e2e.ts` to see which domains already have E2E infrastructure
- Check `apps/webapp-e2e/src/specs/` to see which domains already have Playwright specs
- Check `apps/{domain}/{service}-e2e/` to see if an API E2E project exists

**Do not proceed until questions 1–6 are answered.**

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: write-api-e2e-tests, write-webapp-e2e-tests, e2e-infrastructure")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=endpoints, thoroughness=quick")` — gives you the endpoint inventory to write specs against.
- `Agent(subagent_type="e2e-impact-predictor", prompt="changedFiles={recent diff or full domain path}")` — helps avoid duplicating coverage that already exists.
- `Agent(subagent_type="test-coverage-analyzer", prompt="project={domain}-domain")` — identifies code paths that need E2E coverage.

---

## Phase 1 — E2E Infrastructure (if needed)

**Load skill:** `e2e-infrastructure`

Skip if the domain's tables/DB/queues are already in `scripts/setup-e2e.ts`.

1. Update `scripts/setup-e2e.ts` with table/database/queue configs
2. Update `scripts/teardown-e2e.ts` with matching teardown
3. Update `.env.e2e.example`
4. Update `.github/service-registry.env` with new domain E2E vars (Prisma only: also add `postgres` service to `ci-e2e.yml` and `ci-test-all.yml`)
5. Add API helper functions in `test/e2e/api-helpers.ts`
6. Add factory functions in `test/e2e/test-data.ts`

**Validate:** Run `pnpm e2e:setup` locally. Fix errors before proceeding.

---

## Phase 2 — API E2E Tests (if requested)

**Load skill:** `write-api-e2e-tests`

1. Create `apps/{domain}/{service}-e2e/` project (project.json, jest.config, tsconfig files)
2. Create support files (global-setup, global-teardown, test-setup)
3. Add to `nx.json` Jest plugin exclude
4. Write CRUD spec
5. Write status transition spec (if domain has status lifecycle)
6. Write filtering/pagination spec (if applicable)

**Validate:** Run `pnpm nx e2e {service}-e2e` (requires backend services running). Check `Bash` on all new files.

---

## Phase 3 — Webapp E2E Tests (if requested)

**Load skill:** `write-webapp-e2e-tests`

1. Add `data-testid` attributes to webapp components (table, rows, filters, buttons, badges, forms)
2. Add selector constants to `apps/webapp-e2e/src/utils/selectors.ts`
3. Create page objects (list page, detail page)
4. Add API helper methods to `apps/webapp-e2e/src/fixtures/base.fixture.ts` if needed
5. Write CRUD spec
6. Write actions spec (if domain has status transitions)
7. Write filtering spec (if domain has filters)

**Validate:** Run `pnpm test:e2e:webapp` (requires full stack running). Check `Bash` on all modified files.

---

## Phase 4 — Final Verification

1. Run `Bash` on all new and modified files
2. Confirm CI workflow env vars include new domain variables
3. Confirm data-testid attributes don't break existing webapp tests: `pnpm nx test webapp`
4. Summary: List all created files, modified files, and remaining manual steps
