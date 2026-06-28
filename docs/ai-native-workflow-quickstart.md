# AI-Native Workflow — Quickstart Cheat Sheet

> **One-page reference for every developer.** The codebase is built around guided
> orchestrator prompts that interview you, load the right skills, validate between
> phases, and register every required artifact. Your job is to **describe intent**;
> the orchestrator's job is to **drive execution**.

---

## The One Rule

> **For any structural work, start with a slash command.**
>
> If you're about to create a new file, add a new export, register new wiring, or
> add a new endpoint — your first move is `/<orchestrator>` in Claude Code.
>
> Skills are libraries. Prompts are workflows. **You invoke prompts; prompts invoke skills.**

Bypass orchestrators only for genuinely one-off edits (typo fix, single test tweak,
local variable rename).

---

## Daily Flow (5-step morning routine)

```
1. git pull && git checkout develop
2. VS Code → Tasks: Run Task → "Infra: Start All"   ← once per day
3. Claude Code → /triage-sprint                    ← what should I work on?
4. Pick a bundle (reply with its number)
5. git checkout -b feature/<bundle-slug>
   Claude Code → /<recommended-prompt>             ← the orchestrator drives the rest
```

That's it. Steps 1–5 take ~5 minutes. Everything else is the orchestrator interviewing
you, generating + editing files, running validation gates, and asking for confirmation
between phases.

---

## Daily Flow — Frontend-only (consume existing APIs)

If you only touch `apps/webapp/`, `packages/ui/`, and (occasionally) `packages/client-common/` — and the backend endpoints already exist on dev/preview — you do **not** need LocalStack, Postgres, or any backend service running locally.

```
1. git pull && git checkout develop
2. .env.local → set NEXT_PUBLIC_API_*_URL to deployed dev URLs (one-time)
   Example:
     NEXT_PUBLIC_API_USER_URL=https://abc123.execute-api.eu-west-2.amazonaws.com/user/api
     NEXT_PUBLIC_API_ORDER_URL=https://abc123.execute-api.eu-west-2.amazonaws.com/order/api
     NEXT_PUBLIC_API_AUTH_URL=https://abc123.execute-api.eu-west-2.amazonaws.com/auth/api
3. VS Code → Tasks: Run Task → "Service: Serve webapp"   ← that's the only service
4. Browser → http://localhost:4200/auth/login → sign in once (sets oldst.session cookie)
5. Claude Code → /webapp-feature                         ← Mode A in the interview
```

**Total local infra footprint:** one Next.js dev server. No Docker, no LocalStack, no Postgres, no NestJS services.

### When to use this flow vs the full flow

| Task | Frontend-only flow | Full flow |
|---|---|---|
| Consume an existing API endpoint in a new page | ✅ | overkill |
| Add a filter / column / sort to an existing list | ✅ | overkill |
| Restyle a card / swap a badge / fix copy | ✅ (no orchestrator — just edit) | overkill |
| Dark-mode pass on a domain | ✅ | overkill |
| Accessibility pass | ✅ (use `/fe-accessibility-pass`) | overkill |
| New endpoint or schema field needed | ❌ — backend changes need real infra | ✅ use `/new-feature` or `/full-stack-feature` |
| Anything that touches `packages/{domain}-domain/` | ❌ | ✅ |

### FE-only example session — "redesign the orders table"

```
You: I want to add column-toggle + sort to /orders page. API hasn't changed.

AI: This is a Mode A /webapp-feature run. Confirming:
  • Route: /orders (existing)
  • Backend: no changes, point at deployed dev (skip Infra: Start All)
  • Skill plan: webapp-data-table (TanStack), webapp-new-page (refresh), write-webapp-tests
  • No client-common changes needed (useOrders hook exists)
  Proceed? [Y/n]

You: Y

[Orchestrator runs Phases 2 → 3 → 9 only. Phases 1 (hooks), 4 (forms),
 5 (status mapping), 7 (boundaries), 8 (sidebar) all auto-skipped.]

[~10 min later]
AI: Done. nx test webapp passed. Ready to commit.
```

---

## Decision Tree — Which Prompt for What?

This is the same table that lives in [`CLAUDE.md` §11.1](../CLAUDE.md). Always loaded into Claude Code's context — but pin this for fast human reference.

| I want to... | Use this prompt | Never start with |
|---|---|---|
| Pick something to work on | `/triage-sprint` | Browsing GitHub issues manually |
| Add a brand new bounded context (entity + persistence + service) | `/new-domain` | Skills directly, freehand entity files |
| New DynamoDB-backed domain (skip persistence question) | `/new-domain-dynamo` | `dynamo-repository` skill alone |
| New Prisma-backed domain | Manual scaffold via `new-domain-package` + `prisma-service-wiring` skills (no orchestrator yet) | `/new-domain` (will throw — Prisma not yet supported by the generator) |
| Plain CRUD entity, no business rules | `/quick-crud-domain` | `/new-domain` (overkill) |
| Add a feature to an existing domain (endpoint + use case + business rule) | `/new-feature` | Editing controllers / use cases ad-hoc |
| Add a single new use case to an existing domain | `/new-use-case` | Hand-creating use case folders |
| Add a new microservice to an existing domain | `/new-service` | Copy-pasting another service |
| Backend + webapp + mobile slice of one feature | `/full-stack-feature` | Three separate prompts in sequence |
| Webapp page or admin UI only | `/webapp-feature` | Hand-creating `page.tsx` |
| Async / event-driven work (publisher, consumer, saga) | `/new-event-service` | `sqs-event-driven-service` skill alone |
| Mobile release (OTA, native build, store submission) | `/mobile-release` | Local `eas build` |
| Push notifications end-to-end | `/add-push-notifications` | Mobile-only or backend-only work |
| Accessibility audit / fix axe violations | `/fe-accessibility-pass` | Ad-hoc axe runs |
| New shared UI primitive (web + mobile in lockstep) | `/new-ui-primitive` | Editing one package only |
| New CloudWatch alarm / monitoring view | `/add-monitoring-feature` | Editing monitoring code directly |
| New alerting channel (PagerDuty, Slack, etc.) | `/add-alerting` | Editing `notification-config.json` directly |
| New E2E test suite for a domain | `/new-e2e-tests` | Writing specs without `setup-e2e` |
| Watch a CI run, get self-healing fixes | `/monitor-ci` | Polling `gh run watch` manually |

> **Not sure which prompt?** Just describe the work in plain English in Claude
> Code. It will read §11.1 and propose the right prompt with reasoning.

---

## Anatomy of an Orchestrator Run (example: `/full-stack-feature`)

| Phase | What happens | Your involvement |
|---|---|---|
| **0 — Interview** | 11 structured questions about backend + frontend scope | ~2 min answering |
| **0 — Spec summary** | Echoes captured spec back in a structured block | Confirm or amend |
| **0.5 — Pre-flight** | Subagents in parallel: skill digest, domain explorer, contract diff | Wait ~30s |
| **1 — Domain layer** | Loads `domain-business-rules`, edits entity, adds exception | Review the diff |
| **2 — Contracts** | Loads `add-contracts` + `contracts-subpath-imports`, runs `nx build` | Review the diff |
| **3 — Use case** | Loads `new-use-case`, generates via Nx generator | Review the diff |
| **4–9 — Backend layers** | Repository, app service (with `createLogger`), controller (with `@CurrentUser`), exception filter | Review each phase |
| **10 — Backend tests** | Loads `write-domain-tests`, coverage gate (80% domain, 70% service) | Confirm green |
| **10b — API E2E** | Mandatory if any new endpoint | Confirm spec passes |
| **11 — Shared hooks** | Edits `client-common` (used by webapp + mobile) | Review the diff |
| **12+13 — Frontend (PARALLEL)** | Spawns `webapp-builder` + `mobile-builder` at the same time | Wait ~2–4 min |
| **14 — Frontend tests** | Coverage gate (70% everywhere) | Confirm green |
| **14b — Webapp E2E** | Mandatory if webapp in scope (Playwright) | Confirm spec passes |
| **15 — Post-validate** | Subagents: `dependency-auditor`, `golden-rule-validator`, `e2e-impact-predictor` | Address flags |
| **Final verification** | Full test/build/e2e matrix | Green = ready to PR |

You stay engaged — review diffs, course-correct misinterpretations — but you never
have to remember which file goes where, which Golden Rule applies, which skill to
read, or what wiring needs registering.

---

## Example Sessions

### Example 1 — "What should I work on today?"

```
You:  /triage-sprint
AI:   [interview: milestone? scope? bundle size?]
You:  Sprint 26, me, l
AI:   [report with 3 bundles]
      Bundle 1 — Order discount feature
        Recommended prompt: /full-stack-feature
        Issues: #142, #143, #144
        Branch: feature/142-144-order-discount
      Which bundle would you like to start? (reply with number, or "none")
You:  1
AI:   Stopping triage. To proceed, type:
        git checkout -b feature/142-144-order-discount
        /full-stack-feature
```

### Example 2 — "Add a new bounded context for invoices"

```
You:  I want to add a new domain for invoices
AI:   This is brand-new bounded context work. Routing to /new-domain.
      Should I proceed?
You:  Yes
AI:   /new-domain
      [Phase 0 interview: domain name, entity, fields, statuses, use cases,
       persistence, business rules, events, frontend visibility]
You:  [answers]
AI:   [spec summary echo]
      Confirm? yes / amend X
You:  yes
AI:   [Phase 0.5: parallel subagents for skill digest + similar-domain lookup +
       port reservation]
      [Phase 1: nx-plugin:domain --dryRun → file plan]
      Proceed with generation? yes / refine / cancel
You:  yes
AI:   [generates → pnpm install → get_errors → Phase 3 business rules → ...]
```

### Example 3 — "Add a status to user-domain and surface it in the webapp"

```
You:  I want to add a SUSPENDED status to users with a suspend button in the admin UI
AI:   This is a feature on an existing domain that touches both backend and webapp.
      /full-stack-feature is the right entry. Confirm?
You:  Yes
AI:   /full-stack-feature
      [Phase 0 interview...]
      [Phase 1 — Domain: adds USER_STATUSES.SUSPENDED, suspend() method,
       UserAlreadySuspendedError, runs nx test user-domain]
      [Phase 2 — Contracts: re-exports SUSPENDED, adds suspendUserRequestSchema,
       runs nx build contracts-user]
      ...
```

### Example 4 — "I just need to fix a typo in a comment"

```
You:  fix the typo in user.entity.ts comment line 42
AI:   [makes the edit directly — no orchestrator needed for one-off changes per §11.1 Rule #4]
```

---

## When Things Go Wrong

| Situation | What to do |
|---|---|
| "I'm not sure which prompt to use" | Describe the work in plain English. Claude Code reads §11.1 and proposes one. |
| "The orchestrator misunderstood my Phase 0 spec" | Reply with the correction. Phases are reviewable, not final. |
| "The orchestrator suggested wrong code in Phase 5" | Tell it: "no, the method should be X, not Y". It amends and continues. |
| "I want to skip a phase" | Optional phases (cross-service, frontend, mobile) are skippable via Phase 0 answers. **Mandatory phases (tests, E2E) cannot be skipped — by design.** |
| "CI is failing on my PR" | `/monitor-ci` — watches the run, surfaces failures, offers self-healing. |
| "I exited mid-orchestrator and want to resume" | Each phase produces valid, compilable code. Re-invoke the prompt; it will check existing state and pick up from the next pending phase. |

---

## End of Day

```powershell
# Confirm nothing structural is broken
pnpm exec ts-node --project scripts/tsconfig.json scripts/lint-standards.ts

# Confirm CI is green on your PRs
gh pr status
```

---

## Old Way vs New Way

| Time | Old way | New way |
|---|---|---|
| 9:00 | Browse 30 issues, gut-pick one | `/triage-sprint` → ranked bundles |
| 9:05 | Scan codebase for similar patterns | Bundle includes recommended prompt + similar-domain summary |
| 9:15 | Write entity from memory | Orchestrator interview → first artifact is correct |
| 10:00 | Forget to register service in `service-registry.json` | Phase 4 of `/new-service` won't let you skip it |
| 11:00 | Forget API E2E → CI passes silently | Phase 10b is mandatory; `passWithNoTests:false` |
| 14:00 | PR rejected: "missing `@CurrentUser()`" | Phase 7 loaded skill + reminded about Golden Rule #45 |
| 16:00 | Ad-hoc Slack thread about which primitive to use | `/new-ui-primitive` orchestrates web + mobile together |
| 17:00 | Miss coverage thresholds, rework tomorrow | Phase 10 / 14 gates enforce coverage before "done" |

---

## Required Reading (One-Time, Onboarding Day)

In order, ~45 minutes total:

1. [`README.md`](../README.md) — what this template is and how to set up locally.
2. [`docs/getting-started.md`](getting-started.md) — local infrastructure walkthrough.
3. [`docs/architecture.md`](architecture.md) — Clean Architecture layers and the dependency rule.
4. [`docs/coding-standards.md`](coding-standards.md) — Golden Rules in detail.
5. **This file** — daily workflow.
6. [`CLAUDE.md` §11.1](../CLAUDE.md) — the canonical decision tree.

After that, just open Claude Code and start with `/triage-sprint`. The orchestrators teach you the rest as you go.

---

## Maintainer Notes

- **Adding a new orchestrator prompt?** Add a row to the decision tree above AND to `CLAUDE.md` §11.1. The `prompt-entry-point-sync` lint check (run by `ci-fast-check.yml`) will fail the PR otherwise.
- **Adding a new skill?** Add a row to the skills table in `CLAUDE.md` §11. Skills are loaded by orchestrators — they should rarely be invoked directly by developers.
- **Found a Golden Rule violation pattern?** Consider adding a structural lint check via the `add-structural-lint-check` skill so it can't happen again.
