## Summary

<!-- Briefly describe what this PR changes and why. -->

Closes #<!-- issue number, or remove this line if not linked -->

**Orchestrator(s) used:** <!-- e.g. /new-feature, /webapp-feature, /full-stack-feature, or "none — bug fix" -->
**Spec file(s):** <!-- e.g. .specs/domain-payment.yaml, .specs/page-payments.yaml, or "none" -->

> **Workflow reminder:** open this PR as a **draft** the moment the branch is created, before writing code. CI runs on every push, subagents (`golden-rule-validator`, `dependency-auditor`, `contract-diff-analyzer`) can target the diff at any phase, and the spec YAML committed first becomes the contract reviewers read before the implementation.

## Type of Change

- [ ] Backend domain / service
- [ ] Frontend (webapp)
- [ ] Mobile
- [ ] Shared package (`contracts`, `client-common`, `ui`, `mobile-ui`, etc.)
- [ ] Infrastructure / CI / config
- [ ] Documentation only

---

## Generator-Driven PRs (skip this section if no generator was used)

If this PR was scaffolded by `nx g @mma/nx-plugin:domain`, `:service`, `:event-handler`, or `:use-case`:

- [ ] Generator command(s) used: <!-- e.g. `nx g @mma/nx-plugin:domain --name=payment --persistence=dynamo` -->
- [ ] Scaffold and business logic are committed separately (`chore(scaffold): ...` then `feat(...): ...`) **OR** all changes are clearly summarized below.
- [ ] No hand-edits to files marked `@generated` (regenerate instead).

> **Reviewer focus** — files marked `linguist-generated=true` in `.gitattributes` (boilerplate `main.ts`, modules, configs, dispatchers, interfaces) are auto-collapsed in the GitHub diff. **Review only:**
>
> - `domain/entities/*.entity.ts` — business rules, invariants, state transitions
> - `domain/constants/*.ts` — enum values match product spec
> - `application/use-cases/**/*.ts` — orchestration, error handling, ACL injection
> - `infrastructure/repositories/*.repository.ts` — query patterns, GSI/index choice
> - `infrastructure/schemas/*.ts` (Dynamo) or `prisma/schema.prisma` (Prisma)
> - `presentation/controllers/*.ts` — routes, auth, validation (must NOT call use cases directly)
> - Hand-written `*.spec.ts` files (skip generator-stub specs)
> - `service-registry.json` envVar / IAM / VPC additions
> - Cross-domain event payloads in `contracts/{domain}/event-schemas.ts`

---

## Pre-Flight Checklist

> Items marked ⚡ are enforced automatically by CI (ESLint plugin, coverage thresholds, structural checks).
> Focus your self-review on the unmarked items — those require human judgment.

### Tests

- [ ] Unit tests written (or updated) for changed logic
- [ ] ⚡ Coverage thresholds pass locally: `pnpm nx affected --target=test --coverage`
- [ ] No `it.skip` / `xit` / `test.only` left without explanation

### E2E _(check one per section, or skip if not applicable)_

- [ ] **API E2E** — Not applicable (no backend changes)
- [ ] **API E2E** — Specs added/updated for affected endpoints
- [ ] **Webapp E2E** — Not applicable (no frontend changes)
- [ ] **Webapp E2E** — Playwright specs added/updated; new elements have `data-testid`
- [ ] **Mobile** — Not applicable / Manually tested on device

### Wiring & Config _(only for new services or domains)_

- [ ] New service registered in `.vscode/tasks.json` → `Services: Start All`
- [ ] New service registered in `.github/service-registry.json` and `.github/service-registry.env`
- [ ] `.env.local.example` updated with new environment variables
- [ ] E2E infrastructure added to `scripts/setup-e2e.ts` and `scripts/teardown-e2e.ts`

### Architecture _(human judgment — not fully automatable)_

- [ ] Domain entity invariants and state transitions are correct (business logic review)
- [ ] Cross-service communication uses the correct pattern (ACL / async events / saga)
- [ ] No N+1 queries or missing DB indexes for new list/filter operations

---

> **Automated enforcement (no checkbox needed):**
> Architecture boundaries, import hygiene, hardcoded status strings, domain purity, `NODE_ENV` checks, contracts subpath imports, Prisma client isolation, and controller→use-case boundaries are all caught by `@mma/eslint-plugin` and CI structural checks. See `docs/coding-standards.md` for the full list.
