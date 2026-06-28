---
description: "Build the reusable UI layer for a migrated project — consumes the artifacts from /migrate-extract (component classification, token mapping) and generates new @mma/ui primitives plus domain composites (presentational, prop-driven) under packages/ui/ and apps/webapp/src/components/{domain}/, gated by build+typecheck+lint-standards, RTL unit+coverage, and axe. Does NOT build pages (that is /migrate-page) and does NOT build the backend. USE WHEN the user says 'build the migration UI primitives', 'generate the shared components for the migration', or 'build the composites' AFTER /migrate-extract has run."
---

# Migration → Build UI (primitives + composites)

You orchestrate the **reusable-UI build phase** of a project migration. You consume the analysis artifacts from `/migrate-extract` and build:

1. **New `@mma/ui` primitives** — shared, reusable shadcn-style components classified BUILD-PRIMITIVE.
2. **Domain composites** — presentational, **prop-driven** components classified BUILD-COMPOSITE, written to `apps/webapp/src/components/{domain}/` so the pages built later by `/migrate-page` can compose them.

**This phase does NOT build pages and does NOT touch the backend.** Pages are built once, in their real `(protected)/{route}/` location, by `/migrate-page` (mock → wire). Composites are pure presentation — they receive data via props; the page's `_data/{domain}.adapter.ts` supplies that data (mock first, real after `--wire`).

**Pre-requisite:** `/migrate-extract` must have run — this prompt reads `components/_classification.md`, `domains/`, `tokens/_mapping.md`, and `LEDGER.md` under `{source}-migration/`.

**Two explicit phases the developer MUST approve between:**

- **Phase A — PLAN (read-only)**: produces a build manifest of every primitive + composite. STOPS for approval.
- **Phase B — EXECUTE**: builds in dependency order, runs gates, reconciles the component ledger.

**Do NOT write any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask in a single message and wait:

1. **Migration root?** (e.g. `mma-flow-migration/` — produced by `/migrate-extract`)
2. **Mirror new primitives to mobile?** (default: no — web-only for now).
3. **Composite scope?** Choose one:
   - **All composites** _(default)_ — build every non-deferred BUILD-COMPOSITE item.
   - **Subset** — provide the list of composite names (or domains) to build.
4. **Reference screenshots folder?** The source-mock capture set from `/mock-source-app` (default: `{migrationRoot}/screenshots/`). Each composite is built to match how it actually renders in the source `{state}.png` crops + `{state}.dom.json` structure. If absent, composites are built from the classification cards only (lower fidelity) — note this.

**Do not proceed until question 1 is answered.**

---

## Phase 0.5 — Pre-flight (parallel, read-only)

- Verify `{migrationRoot}` exists with `components/_classification.md`, `domains/`, `tokens/_mapping.md`, and `LEDGER.md`. If any is missing, STOP and tell the developer to run `/migrate-extract` first.
- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: webapp-ui-primitive, webapp-radix-primitive-wrap, webapp-form-with-validation, webapp-skeleton-loading, fe-design-tokens, fe-accessibility-audit, mobile-ui-primitive")`
- Read `packages/ui/src/index.ts` — confirm which classified BUILD-PRIMITIVE items already exist.
- `Glob` the reference screenshots folder (`{migrationRoot}/screenshots/`) if it exists. For each composite, note the source `{state}.png` crop + `{state}.dom.json` that show it in context — these become the visual + structural acceptance target. If the folder is absent, flag that composites will be built from cards only.

---

## PHASE A — PLAN (read-only)

**MUST NOT WRITE ANY CODE.** Output a single build manifest.

### A.1 — Read the classification

From `components/_classification.md` extract the BUILD-PRIMITIVE and BUILD-COMPOSITE lists. For each composite, resolve its owning `domain` (from the composite card / domain cards) — that determines its target folder. From `tokens/_mapping.md` note any `tokens.patch.ts` to apply first. For each primitive, note its `sourceStoriesRef` + combined Story Matrix and the Reuse Map **Story Delta** — these are ported into the target stories and verified by the story-parity gate.

### A.2 — Build manifest (dependency-ordered)

Present a Markdown table. Build order is **primitives → composites** (composites depend on primitives):

| Order | Artifact | Type      | Builder subagent     | Target path                                    | Depends on |
| ----- | -------- | --------- | -------------------- | ---------------------------------------------- | ---------- |
| 1     | {name}   | primitive | ui-primitive-builder | packages/ui/src/components/{name}/             | tokens     |
| 2     | {name}   | composite | composite-builder    | apps/webapp/src/components/{domain}/{name}.tsx | primitives |

Note any token patch to apply and the `pnpm tokens:gen` step. Flag any composite whose primitives are all `deferred` (the composite is deferred too, not dropped).

### A.3 — STOP for approval

End with: _"Reply `approve` to build the primitives + composites, or adjust scope."_ **Do not proceed without approval.**

---

## PHASE B — EXECUTE (after approval)

### Stage A — Apply token patch (if any)

- If `tokens/_mapping.md` proposed a `tokens.patch.ts`, apply it to `packages/design-tokens/src/lib/tokens.ts` (developer-approved values only) and run `pnpm tokens:gen`.

### Stage B — Build (dependency-ordered fan-out)

**B.1 — Primitives** (parallel; one invocation per BUILD-PRIMITIVE item):

`Agent(subagent_type="ui-primitive-builder", prompt="Build the {name} primitive in @mma/ui. name={name} sourceRef={...} variants={...} states={...} radixBase={...} tokenNotes={from tokens/_mapping.md} sourceStoriesRef={path + combined Story Matrix from _classification.md, or '— inferred'} variantRenameMap={the classifier Story Delta for this component}. Port every non-dropped source story export into the target stories so the story-parity gate passes.")`

**B.2 — Composites** (parallel after B.1; one per BUILD-COMPOSITE item). Composites are **prop-driven and presentational** — NO data fetching, NO React Query, NO `@mma/client-common` import. They receive typed props the page will supply via its adapter:

`Agent(subagent_type="composite-builder", prompt="Build the {name} composite as a prop-driven presentational component. name={name} source={composite card} domain={domain} composedOf={primitives} propsShape={from domain card entity fields} states={loading,empty,error,populated} referenceScreenshots={migrationRoot}/screenshots/{route}/ targetPath=apps/webapp/src/components/{domain}/. Match the layout/columns/badges/empty-state shown in the source {state}.png + {state}.dom.json crops. Do NOT fetch data or import client-common — accept all data via props. Include data-testid attributes.")`

After each builder returns, update the ledger: each item → `built` (or `deferred` with reason).

### Stage C — Gates (run after build)

Run and record results in the ledger:

1. **Build + typecheck + lint-standards** — `pnpm exec nx build webapp` + `pnpm exec nx build ui` + the structural lint (`scripts/lint-standards.ts`). Must pass.
2. **RTL unit + coverage** — `pnpm exec nx test webapp` + `pnpm exec nx test ui`. Must meet the 70% (webapp/composites) / 70% (`packages/ui`) thresholds.
3. **Accessibility** — run the axe scan / `fe-accessibility-audit` skill over composites rendered in isolation (Storybook); **zero critical + serious** violations.

If any automated gate fails, fix within scope (or mark the artifact `deferred`) before proceeding.

### Stage C.4 — Story-parity gate (HARD FAIL)

Verify the source Storybook surface survived the migration semantically — every source variant/state is either demonstrated by a target story or carries a recorded transform (rename | merge | split | drop+reason) in the classifier Story Delta.

`Agent(subagent_type="story-parity-auditor", prompt="Diff each source component Story Matrix (components/_raw-inventory.md) against the target story surface — ported @mma/ui primitive stories for BUILD items, existing primitive stories for REUSE items — using the classifier Story Delta as the allowed-transform map. Any unmapped + unexplained source variant/state is a parity-gap = FAIL. Semantic matrix diff only, NOT visual. Write components/STORY_PARITY.md and update LEDGER.md + PARITY.md. migrationRoot={migrationRoot} sourceRoot={sourceRoot} templateRoot={templateRoot}")`

This is a **hard gate**: if the auditor returns **FAIL** (any `parity-gap`), surface the gap list and STOP — do not proceed to reconciliation. Resolve each gap by either porting the missing variant into the target story (preferred) or recording an explicit `drop — reason` in `components/_classification.md`, then re-run the auditor. `stories=inferred` source components are reported, never failed.

> **Why not a cross-Storybook Playwright pixel diff?** Source and target are intentionally NOT a 1:1 visual match — different theme (dark→light), tokens, fonts, and normalised variant names. A pixel diff would be all false-positives. Semantic story-matrix parity is the machine gate; the manual side-by-side Storybook review (in `STORY_PARITY.md`) is the human sign-off.

### Stage D — Component reconciliation (final gate)

`Agent(subagent_type="coverage-auditor", prompt="Reconcile LEDGER.md after the UI build. Every classified component must be built|deferred|skipped. FAIL on any unresolved discovered/mapped component. Update LEDGER.md + PARITY.md and write _reconciliation-build.md. migrationRoot={migrationRoot} phase=build")`

If the auditor returns **FAIL**, surface the unresolved list and stop.

### Stage E — Final report

Summarize: primitives built, composites built/deferred, gate results (including the **story-parity verdict** + any recorded drops), and the reconciliation verdict. Point the developer to the next step:

```
Next:
1. Run /migrate-to-specs to generate domain + page spec YAML (if not already done).
2. Per page, run /migrate-page --mock to build the page in (protected)/{route}/ using the
   composites you just built, fed by an interactive mock adapter.
3. After the backend exists (/new-domain), run /migrate-page --wire.
```

---

## Constraints

- Build ONLY `@mma/ui` primitives and prop-driven domain composites. **No pages** (that is `/migrate-page`) and **no backend**.
- Composites are presentational — NO data fetching, NO `@mma/client-common`, NO React Query. Data arrives via props.
- Build order is strictly primitives → composites.
- Missing components are `deferred` in the ledger — **never silently dropped**.
- Honor the final component reconciliation gate.
- **Honor the story-parity gate (Stage C.4):** an unexplained `parity-gap` HARD-FAILS the workflow. Every dropped source variant needs a recorded reason.
