# Migration Workflow Guide

> How to migrate **any source repository** into the old-st-template Nx Clean-Architecture monorepo, using the orchestrated migration workflow. New-developer onboarding doc — read this start to finish before your first migration.

---

## 1. What this workflow does

It ingests an arbitrary source app (any stack — Vite/React, CRA, Next, etc.) and produces, across seven steps:

1. **Analysis artifacts** under `{source-slug}-migration/` documenting how the source maps onto this template's architecture (stack, routes, domains, components, tokens, user stories, project context, backend runbook).
2. **Spec YAML** under `.specs/` (`domain-{name}.yaml` + `page-{slug}.yaml`) translated from those artifacts — the machine-readable contracts the `/new-domain` and `/migrate-page` builders consume. Specs are written first as **draft v0** (`verified: false`), then promoted to **verified v1** (`verified: true`) after the source mock proves them against the live app.
3. **A runnable source mock + ground-truth captures** — `/mock-source-app` boots the source app on canonical fixtures, captures every route/state/viewport as `{state}.png` + `{state}.dom.json`, and records every gap between the inferred spec and the live app in `SPEC-DELTAS.md`. This is **🚦 Gate #1** (the developer signs off completeness, live-vs-mock).
4. The **reusable UI layer** — new `@old-st/ui` primitives + prop-driven domain composites under `apps/webapp/src/components/{domain}/`, built to match the captured source crops.
5. **Real pages, built once in their final `(protected)/{route}/` location**, each backed by a swappable `_data/{domain}.adapter.ts`: an **interactive mock** seeded from the canonical fixtures first (`--mock`), then **real React Query hooks** after the backend exists (`--wire`). The same `page.tsx` ships to production; only the adapter file changes.
6. **A formal parity verdict** — `/migrate-verify` boots the rebuilt page on the same fixtures and diffs its DOM/visuals against the source-mock captures (`parity-verifier`). This is **🚦 Gate #2** (the developer signs off final parity).
7. A **coverage ledger** (`LEDGER.md`) + **two-way parity map** (`PARITY.md`) that prove nothing from the source was silently lost.

Two sources of truth keep this honest: **completeness** is checked against the **live source app** (ground truth — captured by the mock); **conformance** is checked against the **domain spec**.

**What it intentionally does NOT do:**

- It does **not** build a separate no-auth preview surface. Pages are built in place; a permanent `NEXT_PUBLIC_MOCK_PREVIEW` layout guard lets you view a `--mock` page without a session.
- It does **not** build the backend automatically. The backend is documented + a dependency-ordered `RUNBOOK.md` is produced; you rebuild it domain-by-domain via `/new-domain` using the generated `domain-{name}.yaml`.
- It does **not** generate Playwright/e2e specs in the build phase (the source-mock capture spec + parity-verifier are migration-internal, not shipped app tests).

---

## 2. When to use it

Use it when you have a source codebase you want to rebuild on this template's architecture. Typical triggers (the router recognizes these): _"migrate this project"_, _"extract this repo into the template"_, _"port this codebase"_, _"convert this app to our structure"_.

Do **not** use it for adding a feature to an existing template domain (use `/new-feature`) or building from Figma (use the Figma prompts).

---

## 3. Prerequisites

- The **source repo is checked out locally** and you know its absolute path (e.g. `d:\old-st-flow`).
- All orchestrator prompts are available under `.claude/commands/`: `migrate-extract`, `migrate-to-specs`, `mock-source-app`, `migrate-build-ui`, `migrate-page`, and `migrate-verify`.
- The webapp builds clean (`pnpm exec nx build webapp`) and the design-token pipeline works (`pnpm tokens:gen`).
- The source app **boots locally** and you know its dev command (e.g. `npx vite --mode mock --port 8081` — note: use `npx`, not `bun`, if bun is not on PATH) and which seed/login gets you to a populated state.
- You have decided a **source slug** (kebab name, e.g. `old-st-flow`) — it names the output folder.

---

## 4. The prompts at a glance

| Prompt                          | Phase          | Produces                                                                        | Writes code?               |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------- | -------------------------- |
| `/generate-source-stories`      | Pre-extraction | `.stories.tsx` files written into source repo — enriches extraction input       | Yes (source stories only)  |
| `/migrate-extract`              | Analysis       | `{source}-migration/` artifacts (Markdown + CSV)                                | No                         |
| `/migrate-to-specs`             | Translation    | `.specs/domain-{name}.yaml` + `page-{slug}.yaml` (**draft v0**)         | No (YAML specs only)       |
| `/mock-source-app`              | Mock + capture | source mock + `fixtures/`, `screenshots/`, `SPEC-DELTAS.md` → **🚦 Gate #1**    | Yes (into the SOURCE repo) |
| `/migrate-to-specs --reconcile` | Reconcile      | promotes specs to **verified v1** by folding in approved `SPEC-DELTAS.md`       | No (YAML specs only)       |
| `/migrate-build-ui`             | UI build       | `@old-st/ui` primitives + prop-driven composites in `components/{domain}/`      | Yes (UI layer)             |
| `/migrate-page`                 | Page build     | One real page in `(protected)/{route}/` + swappable adapter (`--mock`→`--wire`) | Yes (pages)                |
| `/migrate-verify`               | Parity         | DOM/visual diff destination vs source-mock → `PARITY-*.md` → **🚦 Gate #2**     | No (parity reports only)   |

`/generate-source-stories` is **optional but recommended** whenever the source repo has no Storybook stories or incomplete story coverage. It writes stories directly into the source repo so the inventory agent in `/migrate-extract` has the richest possible variant-matrix input. See §5 Step 0 for when to use it.

All prompts are **2-phase** (a read-only PLAN you approve, then EXECUTE), except `/migrate-page` which is single-staged per page. `/migrate-extract` has its own classification gate mid-run; `/mock-source-app` ends at **Gate #1** and `/migrate-verify` ends at **Gate #2** — the two human sign-off points of the workflow.

---

## 5. Step-by-step

### Step 0 (Optional) — Run `/generate-source-stories`

**Run this step if the source repo has no Storybook stories or sparse story coverage** — it dramatically improves extraction quality by giving the inventory agent a precise variant matrix for every component.

Type `/generate-source-stories`. Answer the interview (source path, components folder, overwrite policy). It then analyzes every UI component `.tsx` file in the source — reading `cva()` definitions, exported sub-component APIs, TypeScript prop types, and real-world usage patterns in feature pages — and writes a `.stories.tsx` file for each component that documents:

- **Variant matrix** (`Default` + `Variants` exports): all `cva()` enum combinations, domain-relevant labels
- **State matrix** (`States` exports): disabled, loading, icon-only, with/without children
- **Composition API** (for structural components like Card, Table, Form): sub-component assembly using real fixture content from the source's feature pages

After writing, it runs `npx tsc --noEmit` to confirm type correctness.

**When to skip this step:** The source already has comprehensive story coverage (≥80% of components have a `.stories.tsx` file with ≥2 exports). `old-st-flow` has 100% coverage — no need to run this step for that migration.

### Step 1 — Run `/migrate-extract`

Type `/migrate-extract`. Answer the interview (source path, slug, optional router/data/milestone hints, scope). It then:

1. **Phase A (PLAN)** — profiles the source stack and shows an execution plan. Review and reply `approve`.
2. **Stage 0 (Discovery)** — five read-only subagents run in parallel and seed the ledger (every route + component + candidate-domain = `discovered`).
3. **Stage 1 (Classify & synthesize)** — components are clustered/deduped and classified (reuse / build / drop); domains are synthesized into rich Markdown with a per-domain **DynamoDB-vs-Prisma recommendation**.

#### Classification gate (your review, mid-extract)

The orchestrator stops and shows you the component classification + domain map. You:

- Approve or override any dedup/drop decisions.
- **Confirm the persistence choice (DynamoDB or Prisma) for each domain.**

Your confirmed choices are recorded in the ledger and each `domain-{name}.md`. (This is an extract-internal review, distinct from the two human sign-off gates below.)

After the classification gate it continues: token mapping → user stories + project context → backend runbook → **reconciliation** (the coverage-auditor fails the run if anything is still `discovered`). Review the final report, then read through `{source}-migration/` (see the output map in §6). Pay special attention to `domains/INDEX.md`, `components/_classification.md`, and `LEDGER.md`.

### Step 2 — Run `/migrate-to-specs` (draft v0)

Type `/migrate-to-specs`. Answer the interview (migration root, scope, overwrite policy). It translates the rich-Markdown cards into machine-readable spec YAML:

1. **Phase A (PLAN)** — lists every `domain-{name}.yaml` and `page-{slug}.yaml` it will write. Reply `approve`.
2. **Stage 1** — one `domain-spec-writer` subagent per domain card → `.specs/domain-{name}.yaml` (single entity per file; child entities captured as business rules / index notes; persistence carried from the classification gate).
3. **Stage 2** — one `page-spec-writer` subagent per route card → `.specs/page-{slug}.yaml`, with a mandatory **field-resolution cross-check**: every column / detail field / filter source / form field / action must resolve to a field or enum in the domain spec. Unresolved references are annotated `# TODO:` and reported — **never dropped**.
4. **Stage 3** — merges `context/PROJECT_CONTEXT.md` into `docs/PROJECT_CONTEXT.md`.
5. **Stage 4–5** — field reconciliation + ledger reconciliation → `_reconciliation-specs.md`.

These are written as **draft v0** (`status: draft`, `verified: false`) — they encode what could be _inferred from source code_, which is lossy about real enum coverage, real optionality, and computed/joined fields. Don't build from them yet; first prove them against the live app in Step 3. Resolve any blatant `# TODO:` field gaps before continuing.

### Step 3 — Run `/mock-source-app` → 🚦 Gate #1

Type `/mock-source-app`. This is the **completeness verification step** — it runs the source app on canonical fixtures and compares it against the draft spec. It:

1. **Phase A (PLAN)** — interview (source path, dev command, routes/states to capture, viewports, themes, deep links). Reply `approve`.
2. **Phase A.5 (Pre-flight)** — reads the draft `domain-*.yaml` / `page-*.yaml` skeletons and the source data seam.
3. **Phase B (BUILD + ENRICH)** — writes a mock data seam into the **SOURCE repo** (e.g. `src/mock/`), seeded from DTO-shaped `fixtures/*.json`. The fixtures start from the spec skeleton, then are **enriched against the live app** (every real enum value, every real optionality, every computed/joined field, ≥3 rows per entity). Every mock handler returns the **exact real entity ids** from fixtures — never positional re-indexing. It then runs a Playwright `capture.spec.ts` that emits `{state}.png` + `{state}.dom.json` per route/state/viewport into `screenshots/`, and records every divergence between the inferred spec and the live app in `SPEC-DELTAS.md`.
4. **Phase C — 🚦 Gate #1 (HALT).** The orchestrator stops. **You** review `SPEC-DELTAS.md` and the screenshots side-by-side with the live app and confirm the mock is a faithful, complete reproduction. Nothing proceeds until you sign off.

The fixtures (canonical, in the source repo `src/mock/fixtures/`), screenshots, `.dom.json`, and `SPEC-DELTAS.md` are also copied into `{source}-migration/` so the rest of the pipeline can consume them.

### Step 4 — Run `/migrate-to-specs --reconcile` (verified v1)

Type `/migrate-to-specs --reconcile`. With Gate #1 passed, this folds the approved `SPEC-DELTAS.md` back into the draft specs:

1. **Reconcile PLAN** — shows a delta-kind → spec-edit table (new field / new enum value / changed optionality / computed-joined field / new page state). **Review the proposed YAML edits and approve** — this is a separate, lighter approval than Gate #1 (you're confirming the spec edits, not the mock).
2. **Reconcile APPLY** — applies the edits, resolves outstanding `# TODO:`s, re-runs the field-resolution cross-check, and flips each touched spec to `status: verified`, `verified: true`, with a `verifiedAgainst` stamp. Specs are validated against the JSON Schema.

Specs become **verified only via this `--reconcile` pass** — never directly from the inferred draft. Now they reflect the live app, and you can safely build.

### Step 5 — Run `/migrate-build-ui`

Type `/migrate-build-ui`. Answer the interview (migration root, optional mobile mirror, composite scope, reference-screenshots folder). It:

1. **Phase A (PLAN)** — shows a dependency-ordered build manifest (primitives → composites). Reply `approve`.
2. **Stage A–B** — optionally applies the token patch + `pnpm tokens:gen`, then builds new `@old-st/ui` primitives, then **prop-driven** domain composites into `apps/webapp/src/components/{domain}/`. Each composite is built to **match the captured source crops** (`{state}.png` + `{state}.dom.json`) — layout, columns, badges, empty-state. Composites receive data via props (no data fetching).
3. **Stage C (Gates)** — build + typecheck + lint-standards, RTL unit + coverage, axe (critical + serious), then the **story-parity gate**.
4. **Stage C.4 — Story-parity gate (HARD FAIL)** — spawns `story-parity-auditor`, which diffs each source component's **Story Matrix** (every variant/size/intent/state the source Storybook demonstrated) against the **target** story surface (the ported `@old-st/ui` primitive stories for BUILD items; the existing primitive stories for REUSE items). Every source variant/state must either be demonstrated by a target story OR carry a recorded transform (rename | merge | split | `drop — reason`) in the classifier Story Delta. Any unmapped + unexplained variant is a `parity-gap` and the workflow **STOPS**. It writes `components/STORY_PARITY.md`. `stories=inferred` source components (no source story to compare) are reported, never failed.
5. **Stage D** — component reconciliation (also consumes `STORY_PARITY.md` — an unexplained gap fails reconciliation too).

> **Why semantic story-parity and NOT a cross-Storybook Playwright pixel diff?**
> The source and target are intentionally **not** a 1:1 visual match — the target is re-themed (source dark → template light-default), re-tokenised (`@old-st/design-tokens`), re-fonted (Mulish vs Inter/Poppins), and variant names are normalised (`danger → destructive`). A pixel diff across the two Storybooks would be **all false-positives**. So the machine gate compares the **variant/state coverage matrix** (does the target still demonstrate every surface the source did, or is each omission recorded?). The **manual side-by-side Storybook review** — a checklist printed in `STORY_PARITY.md` — is the human sign-off for actual appearance.

### Step 6 — Run `/migrate-page` per page (`--mock`)

For each route, type `/migrate-page` and choose `--mock`. It spawns `migration-page-builder`, which:

- Builds the page **once, in its real `apps/webapp/src/app/(protected)/{route}/` location** (thin orchestrator + `error.tsx` + `loading.tsx`).
- Writes `_data/{domain}.adapter.ts` — an **interactive** mock adapter (module-level store + listeners) **seeded from the canonical `{source}-migration/fixtures/` produced in Step 3**, so filtering / adding / status changes actually work in the UI and the page runs on the _same_ data `/migrate-verify` will diff against. (Falls back to spec-synthesized rows if a fixture is absent.)
- Matches the captured `{state}.png` + `{state}.dom.json` for the route as its structural + visual acceptance target.
- The page imports its data **only** from the adapter (never `@old-st/client-common` yet).

After building, the prompt runs a fast local self-screenshot check (boot `MOCK_PREVIEW`, capture states, compare against the reference crops) — a preview of Gate #2.

View it: set `NEXT_PUBLIC_MOCK_PREVIEW=true` and `NEXT_PUBLIC_STAGE=local` in `.env.local`, run `pnpm nx serve webapp`, and open `/{route}`. The permanent layout guard bypasses the auth redirect only while both flags are set.

### Step 7 — Run `/migrate-verify` → 🚦 Gate #2

Once a `--mock` page is built, type `/migrate-verify` to get the formal parity verdict. It:

1. **Phase A (PLAN)** — interview (migration root, destination URL, routes/states to verify). Reply `approve`.
2. **Phase A.5 (Pre-flight)** — confirms the source-mock captures (`screenshots/{route}/{state}.dom.json`) and the destination route exist.
3. **Phase B (VERIFY)** — boots the destination webapp in `MOCK_PREVIEW` mode and spawns one read-only `parity-verifier` subagent per route. Each diffs the destination DOM structure against the source-mock `.dom.json` (PNG comparison is advisory — the two are intentionally re-themed), emits a `PASS` / `FAIL` / `inconclusive` verdict, and writes `parity/PARITY-{route}.md` + a side-by-side PNG. Results aggregate into `parity/PARITY-SUMMARY.md`.
4. **Phase C — 🚦 Gate #2 (HALT).** The orchestrator stops and shows the parity summary. **You** review and give the final sign-off (or send specific routes back to `/migrate-page` / `/migrate-build-ui` to fix).

### Step 8 — Rebuild the backend, then `/migrate-page --wire`

Follow `RUNBOOK.md` (dependency-ordered). Per domain: run `/new-domain` using the generated **verified** `domain-{name}.yaml` (with the confirmed DB), then add the API client + React Query hooks (`webapp-api-client-hooks` skill). Once the hooks + contract schemas exist, run `/migrate-page` again and choose `--wire` for that page. It:

- Runs the `parse-page-spec` Mode-A gate. If the hooks/schemas are missing it reports `needs_backend` and **stops** (it never stubs).
- Rewrites **only** `_data/{domain}.adapter.ts` to re-export the real hooks from `@old-st/client-common` and the types from `@old-st/contracts/{domain}`.
- `page.tsx` stays **byte-identical** — the only file that differs between mock and real is the adapter.

Unset `NEXT_PUBLIC_MOCK_PREVIEW` to restore the real auth gate. Import `issues/user-stories.csv` via `/import-estimate-csv`.

---

## 6. Output map — what `{source}-migration/` contains

```
{source-slug}-migration/
  STACK.md                       # source stack → template target mapping
  routes/
    INDEX.md                     # every navigable surface
    route-{slug}.md              # one card per route (data deps, components, states, gates)
  domains/
    _candidates.md               # raw candidate contexts (from SQL = authoritative model)
    INDEX.md                     # finalized bounded contexts + DB recommendation
    domain-{name}.md             # rich-Markdown domain spec source (entities, rules, use cases, endpoints)
  components/
    _raw-inventory.md            # exhaustive component inventory (incl. the source Story Matrix)
    _classification.md           # reuse / build-primitive / build-composite / drop + dedup clusters + Story Delta
    STORY_PARITY.md              # semantic source↔target Story Matrix diff (build phase); hard gate
    composites/                  # one card per composite component
  tokens/
    _source-tokens.md            # harvested source tokens (verbatim)
    _mapping.md                  # source → two-tier @old-st/design-tokens mapping
    tokens.patch.ts              # PROPOSED token patch (apply only on approval)
  issues/
    user-stories.csv             # canonical 10-column CSV for /import-estimate-csv
    FEATURES_AND_USER_STORIES.md # epics + stories narrative
  context/
    PROJECT_CONTEXT.md           # purpose, actors, glossary, workflows, NFRs
  fixtures/                      # canonical DTO-shaped fixtures (copied from SOURCE repo src/mock/fixtures/)
    {entity}.json                # one file per entity; mock adapters + /migrate-page --mock seed from these
  screenshots/                   # ground-truth captures from /mock-source-app (the live source on fixtures)
    {route}/
      {state}.png                # visual acceptance target per route/state/viewport/theme
      {state}.dom.json           # structural acceptance target (DOM dump) — parity-verifier diffs against this
    MANIFEST.md                  # route | state | viewport | theme | deep-link | wait-for capture matrix
  SPEC-DELTAS.md                 # every gap between inferred draft spec and the live app (Gate #1 input)
  parity/
    PARITY-{route}.md            # per-route destination-vs-source-mock diff verdict (/migrate-verify)
    PARITY-SUMMARY.md            # aggregated parity verdict (Gate #2 input)
  RUNBOOK.md                     # dependency-ordered backend rebuild plan
  LEDGER.md                      # coverage ledger (source of truth for completeness)
  PARITY.md                      # two-way source ↔ target map
  _reconciliation-extract.md     # extract-phase audit verdict
  _reconciliation-specs.md       # spec-translation audit verdict (/migrate-to-specs)
  _reconciliation-build.md       # UI-build audit verdict (/migrate-build-ui)
```

The **canonical** fixtures live in the **source repo** at `src/mock/fixtures/*.json` (next to the mock seam `/mock-source-app` writes there); the `{source}-migration/fixtures/` copy is what the template-side prompts consume. All of `{source}-migration/` is **committed to git** for PR review.

---

## 7. Reading the LEDGER and PARITY

### Statuses (LEDGER.md)

| Status       | Meaning                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `discovered` | Found during Stage 0 — **non-terminal**. Any remaining `discovered` item FAILS reconciliation. |
| `documented` | Captured in a rich-Markdown artifact (routes/domains/components/tokens).                       |
| `built`      | UI artifact produced (primitive / composite) or page built (`--mock` adapter or `--wire`).     |
| `deferred`   | Intentionally postponed — **requires a recorded reason**.                                      |
| `skipped`    | Intentionally excluded — **requires a recorded reason**.                                       |
| `wired`      | Page's adapter swapped to real hooks via `/migrate-page --wire` (backend live).                |

### LEDGER.md template

```markdown
# Migration Coverage Ledger: {source-slug}

## Routes

| Surface  | Source path           | Status     | Artifact                | Notes |
| -------- | --------------------- | ---------- | ----------------------- | ----- |
| /example | src/pages/Example.tsx | documented | routes/route-example.md |       |

## Components

| Component | Source path                  | Classification | Status     | Target            | Notes |
| --------- | ---------------------------- | -------------- | ---------- | ----------------- | ----- |
| Button    | src/components/ui/button.tsx | reuse          | documented | @old-st/ui Button |       |

## Domains

| Domain  | Persistence (confirmed) | Status     | Artifact                  | Notes |
| ------- | ----------------------- | ---------- | ------------------------- | ----- |
| tickets | Prisma                  | documented | domains/domain-tickets.md |       |

## Tokens

| Source token | Intent              | Status     | Target              | Notes                         |
| ------------ | ------------------- | ---------- | ------------------- | ----------------------------- |
| --coral      | interactive/primary | documented | tokens/\_mapping.md | dark-only → light synthesized |
```

### PARITY.md template

```markdown
# Source ↔ Target Parity Map: {source-slug}

## Source → Target

| Source surface/component/entity | Target location               | Status |
| ------------------------------- | ----------------------------- | ------ |
| /projects (route)               | (protected)/projects/page.tsx | built  |

## Target → Source (orphan check)

| Target artifact               | Originating source item |
| ----------------------------- | ----------------------- |
| (protected)/projects/page.tsx | /projects               |
```

---

## 8. Verification gates checklist

The workflow has **three gates**: one automated (story-parity, in `/migrate-build-ui`) and **two human sign-off gates** (🚦 Gate #1 completeness, 🚦 Gate #2 parity).

### 🚦 Gate #1 — mock completeness (`/mock-source-app`)

Before approving, confirm against the **live source app** (the ground truth):

- [ ] The source app boots on the mock seam and every captured route reaches its populated state.
- [ ] Every mock handler returns the **real entity ids** from the fixtures (no positional re-indexing); computed counts are derived from rows.
- [ ] Fixtures cover **every enum value**, real optionality, and computed/joined fields, with **≥3 rows per entity**.
- [ ] `SPEC-DELTAS.md` lists every divergence between the inferred draft spec and the live app, and you have reviewed it.
- [ ] `screenshots/{route}/{state}.png` + `.dom.json` match the live app for each route/state/viewport/theme in `MANIFEST.md`.

### Automated story-parity gate (`/migrate-build-ui`)

The UI build phase must pass all of these (recorded in the ledger):

- [ ] `pnpm exec nx build webapp` + `pnpm exec nx build ui` succeed (build + typecheck).
- [ ] `scripts/lint-standards.ts` structural lint passes.
- [ ] `pnpm exec nx test webapp` + `pnpm exec nx test ui` pass and meet the 70% coverage thresholds.
- [ ] axe scan: **zero critical + serious** violations on every primitive/composite (via Storybook).
- [ ] `story-parity-auditor` returns **PASS** (every source Story Matrix variant/state demonstrated by a target story or carrying a recorded transform) → `components/STORY_PARITY.md`.
- [ ] `coverage-auditor` returns **PASS** (100% component reconciliation, no orphans).

Each `/migrate-page` build additionally runs `pnpm exec nx build webapp` + `nx test webapp` for the new route before reporting success.

### 🚦 Gate #2 — parity verdict (`/migrate-verify`)

Before final sign-off:

- [ ] `parity/PARITY-{route}.md` exists for every verified route with a **PASS** DOM-structure verdict.
- [ ] `parity/PARITY-SUMMARY.md` shows no `FAIL` (and you've triaged any `inconclusive`).
- [ ] Side-by-side PNGs reviewed — re-theme differences are expected; structural/state differences are not.

### How to verify a `--mock` page

Set `NEXT_PUBLIC_MOCK_PREVIEW=true` + `NEXT_PUBLIC_STAGE=local`, run the webapp, open `/{route}`, and compare side-by-side with the source app (layout, states, tokens, interactions). Adjust the adapter fixture or components as needed — then unset the flag.

---

## 9. Build-once: the mock → wire adapter

There is **no preview surface to promote** in this workflow. Each page is built once, in its final `apps/webapp/src/app/(protected)/{route}/` location, and stays there. What changes between stages is a single file: `_data/{domain}.adapter.ts`.

**Stage 1 — `/migrate-page --mock`:**

1. `page.tsx`, its components, `error.tsx`, and `loading.tsx` are built in the real route folder.
2. `_data/{domain}.adapter.ts` exports hook-shaped functions (matching the page spec's `dataSources`) backed by an **interactive** in-memory store — fixture shape derived from the domain spec; filter / add / status-change mutate the store so the UI behaves like the real thing.
3. View it with `NEXT_PUBLIC_MOCK_PREVIEW=true` + `NEXT_PUBLIC_STAGE=local` (the permanent layout guard bypasses auth locally — see the `interactive-mock-state` skill and Rule #23e). Production never sets the flag; the API re-validates every request, so layout auth is UX, not security.

**Stage 2 — `/migrate-page --wire` (after the backend + hooks exist):**

1. The builder gates on `parse-page-spec` Mode A — if the hooks/contract schemas are missing it returns `needs_backend` and stops. Run `/new-domain` for that domain first.
2. It rewrites **only** `_data/{domain}.adapter.ts` to re-export the real React Query hooks from `@old-st/client-common` and types from `@old-st/contracts/{domain}`.
3. `page.tsx` is **byte-identical** to the mock version. Unset `NEXT_PUBLIC_MOCK_PREVIEW` to restore the real auth gate.

This eliminates the old double-build (preview page + production page) — you build the page UI exactly once.

---

## 10. Troubleshooting & FAQ

- **`/migrate-build-ui` says extract hasn't run.** It needs `components/_classification.md`, `routes/INDEX.md`, `tokens/_mapping.md`, and `LEDGER.md`. Run `/migrate-extract` first.
- **Should I build from the draft v0 spec?** No. Draft specs (`verified: false`) only encode what was inferable from source code — they miss real enum coverage, real optionality, and computed/joined fields. Run `/mock-source-app` (Gate #1) then `/migrate-to-specs --reconcile` to get a verified v1 first.
- **`/mock-source-app` can't boot the source app.** Confirm the dev command in its interview (use `npx`, not `bun`, if bun isn't on PATH) and that the fixtures/seed produce a populated state. The capture spec waits for the `wait-for` selector listed in `MANIFEST.md`.
- **A mock list/detail shows wrong counts or broken links.** The mock handler re-indexed ids instead of returning the real fixture ids. Every handler must return the **exact entity ids** from the fixtures; computed counts must be derived from the rows. (See the `source-mock-data-system` skill — this is the #1 failure mode.)
- **`/migrate-to-specs --reconcile` says SPEC-DELTAS.md is missing/unapproved.** Reconcile requires the draft specs **and** an approved `SPEC-DELTAS.md` from a passed Gate #1. Run `/mock-source-app` and sign off Gate #1 first.
- **`/migrate-verify` returns FAIL or inconclusive.** Open `parity/PARITY-{route}.md` for the structural diff. Fix the page (`/migrate-page`) or the composite (`/migrate-build-ui`) and re-run. PNG mismatches alone are advisory (the target is intentionally re-themed) — the DOM-structure diff is the binding signal.
- **`/migrate-page` says specs are missing.** It needs `.specs/page-{slug}.yaml` + `domain-{domain}.yaml`. Run `/migrate-to-specs` first.
- **`/migrate-page --wire` returns `needs_backend`.** The domain's React Query hooks / contract schemas don't exist yet. Run `/new-domain` for that domain (from the generated `domain-{name}.yaml`), add the hooks, then re-run `--wire`.
- **A `--mock` page renders but redirects to login.** Set both `NEXT_PUBLIC_MOCK_PREVIEW=true` AND `NEXT_PUBLIC_STAGE=local` in `.env.local` — the guard requires both.
- **Reconciliation FAILed with `discovered` items.** Something wasn't classified/documented. Open `_reconciliation-{phase}.md` for the exact list; re-run the relevant stage or explicitly `defer`/`skip` (with a reason).
- **Re-running a single stage.** The prompts are idempotent at the artifact level — re-running a stage overwrites its artifacts and re-reconciles. Partial runs are supported (scope to a subset in `/migrate-build-ui`; one page at a time in `/migrate-page`).
- **Overriding a dedup decision.** Do it at Gate #1 — tell the orchestrator to keep/merge differently before approving classification.
- **A page references a component that wasn't built.** It is marked `deferred` in the ledger (never dropped). Build the missing primitive/composite via `/migrate-build-ui`, then re-run `/migrate-page`.
- **A page field has a `# TODO:` annotation.** `/migrate-to-specs` couldn't resolve it to a domain field. Fix the domain spec or the page spec before building.
- **Token contrast fails axe.** Fix the value in `tokens.ts` (the token source of truth) and `pnpm tokens:gen` — not in the consuming component.

---

## 11. Worked example — `old-st-flow`

`old-st-flow` is a Vite 5 + React 18 + shadcn/ui + Supabase app (20 feature folders, 48 UI primitives, 69 SQL migrations). It already has **48 `.stories.tsx` files** (100% component coverage), so Step 0 is skipped.

1. _(Step 0 skipped — stories already complete)_
2. `/migrate-extract` → source path `d:\old-st-flow`, slug `old-st-flow`, router hint `react-router-dom v6`, data hint `supabase + sql migrations`. Approve PLAN. Discovery seeds the ledger; the classification gate marks shadcn primitives as **reuse**, confirms `tickets`/`projects` → **Prisma** and `active_timers` → **DynamoDB**. Extraction finishes with token map, `user-stories.csv`, `PROJECT_CONTEXT.md`, `RUNBOOK.md`, reconciliation PASS.
3. `/migrate-to-specs` → translates each domain/route card into **draft v0** `.specs/*.yaml` (`verified: false`), cross-checking that every page field resolves to a domain field.
4. `/mock-source-app` → writes a Supabase mock seam into `d:\old-st-flow/src/mock/`, seeded from enriched `fixtures/*.json`; boots `npx vite --mode mock --port 8081`; captures every route/state as `{state}.png` + `{state}.dom.json`; records gaps (real enum values, optional fields, computed joins) in `SPEC-DELTAS.md`. **🚦 Gate #1:** review deltas + screenshots vs the live app, sign off.
5. `/migrate-to-specs --reconcile` → folds `SPEC-DELTAS.md` into the specs, approve the YAML edits, specs flip to **verified v1** (`verified: true`).
6. `/migrate-build-ui` → builds any missing `@old-st/ui` primitives and prop-driven composites (WeeklyHoursBar, TicketCard) matching the captured crops. Gates run (incl. story-parity hard fail).
7. `/migrate-page --mock` per route → builds e.g. `(protected)/projects/page.tsx` + `_data/project.adapter.ts` seeded from `old-st-flow-migration/fixtures/`. View with `NEXT_PUBLIC_MOCK_PREVIEW=true` + `NEXT_PUBLIC_STAGE=local`.
8. `/migrate-verify` → boots the destination on the same fixtures, `parity-verifier` diffs each route's DOM against the source-mock captures → `PARITY-SUMMARY.md`. **🚦 Gate #2:** final parity sign-off.
9. Follow `RUNBOOK.md` to rebuild each backend domain via `/new-domain` (from the verified YAML), add hooks, then `/migrate-page --wire` to swap each page's adapter to the real hooks. `page.tsx` never changes.

---

**See also:** `docs/AGENT_ARCHITECTURE.md` (3-tier agent model), `docs/agents-catalog.md` (subagent catalogue), the `interactive-mock-state` skill, `docs/coding-standards.md`, and the webapp golden rules in `CLAUDE.md`.
