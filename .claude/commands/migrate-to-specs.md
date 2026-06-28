---
description: "Translate completed migration analysis artifacts ({source}-migration/) into schema-valid spec YAML under .specs/ — fans out one domain-spec-writer per domains/domain-{name}.md and one page-spec-writer per routes/route-{slug}.md, runs a field-resolution cross-check (every page field/filter/form key must resolve to a field/enum in its owning domain spec), merges context/PROJECT_CONTEXT.md into docs/PROJECT_CONTEXT.md, and reconciles against the migration LEDGER so nothing is silently dropped. Produces NO production code. Bridges /migrate-extract → /new-domain + /migrate-page. ALSO supports `--reconcile` mode: folds the developer-approved {slug}-migration/SPEC-DELTAS.md (from /mock-source-app Gate #1) into the existing draft specs, promoting them from draft v0 (verified:false) to verified v1 (verified:true). USE WHEN the user says 'migrate to specs', 'generate specs from the migration', 'turn the migration cards into YAML', 'reconcile the specs', 'migrate-to-specs --reconcile', or after /migrate-extract or /mock-source-app finishes."
---

# Migration Artifacts → Spec YAML

You orchestrate the **translation phase** of a project migration. The `/migrate-extract` phase produced rich-Markdown analysis artifacts under `{source}-migration/`. Your job is to translate those cards into **schema-valid spec YAML** under `.specs/` that the downstream `/new-domain` (backend) and `/migrate-page` (webapp) workflows consume.

**This phase writes ONLY spec YAML under `.specs/` (plus one merged `docs/PROJECT_CONTEXT.md`). It generates NO production code and does NOT touch the backend or webapp.**

**Two explicit phases the developer MUST approve between:**

- **Phase A — PLAN (read-only)**: inventories the migration cards, maps them to output spec files, and shows the plan. STOPS for approval.
- **Phase B — EXECUTE**: fans out the writer subagents, runs the field-resolution cross-check, merges project context, and reconciles the ledger.

**Do NOT call any tools or write any artifacts until Phase 0 is complete.**

---

## Phase 0 — Mode detection + Interview

**First, detect the mode from the invocation:**

- If the user passed **`--reconcile`** (or said "reconcile the specs", "fold in the deltas", "promote to verified") → run **Reconcile Mode** (see the dedicated section below) instead of the generate flow. Reconcile Mode requires that draft specs already exist AND `{slug}-migration/SPEC-DELTAS.md` exists and has been approved at Gate #1.
- Otherwise → run the standard **Generate** flow (Phases A/B below). Newly generated specs are written as **draft v0** with `status: draft` and `verified: false` at the top of each file, signalling they have NOT yet been checked against the live app.

Ask in a single structured message and wait for answers.

1. **Migration root?** The extraction output folder (e.g. `old-st-flow-migration`). Default: auto-detect the single `*-migration/` folder at the workspace root; if more than one exists, ask.
2. **Scope?**
   - **Full** _(default)_ — all domain cards → domain specs AND all route cards → page specs.
   - **Domains-only** — only `domains/domain-*.md` → domain specs (skip page specs).
   - **Pages-only** — only `routes/route-*.md` → page specs (requires domain specs to already exist for the cross-check).
3. **Overwrite policy?** If a target spec already exists in `.specs/`: **skip** _(default)_, **overwrite**, or **ask per file**.

**Do not proceed until question 1 is answered (or auto-detected).**

---

## Phase 0.5 — Pre-flight (parallel, read-only)

Run in parallel:

- Confirm the migration root exists and list `domains/`, `routes/`, `components/`, `context/`.
- Read `{migrationRoot}/domains/INDEX.md` (confirmed persistence per domain) and `{migrationRoot}/routes/LEDGER.md` (or `{migrationRoot}/LEDGER.md`) — the reconciliation source of truth.
- Read `{migrationRoot}/components/_classification.md` (reuse vs build — passed to page-spec-writer).
- Read both schemas: `.specs/schemas/domain-spec.schema.json` and `.specs/schemas/page-spec.schema.json`.
- `Glob(".specs")` — detect existing specs for the overwrite policy.

Wait for all to return.

---

## PHASE A — PLAN (read-only)

This phase **MUST NOT WRITE ANY SPEC**. Output is a single approval document.

### A.1 — Build the translation inventory

From the migration root, list:

- Every `domains/domain-{name}.md` → planned `.specs/domain-{name}.yaml` + its **confirmed persistence** (from `domains/INDEX.md` / each card's header).
- Every `routes/route-{slug}.md` → planned `.specs/page-{slug}.yaml` + its **owning domain** (inferred from the card's "Target route" + data dependencies). Flag any route card with NO clear owning domain (e.g. login, 404, loading) as **skip** with a reason — these are not page-spec candidates.
- `context/PROJECT_CONTEXT.md` → planned merge into `docs/PROJECT_CONTEXT.md`.

### A.2 — Present the plan

Show a table:

| Source card               | → Output spec                      | Domain  | Persistence | Action (write/skip/overwrite) | Notes                   |
| ------------------------- | ---------------------------------- | ------- | ----------- | ----------------------------- | ----------------------- |
| domains/domain-project.md | .specs/domain-project.yaml | project | dynamodb    | write                         |                         |
| routes/route-projects.md  | .specs/page-projects.yaml  | project | —           | write                         | owning domain: project  |
| routes/route-login.md     | —                                  | —       | —           | skip                          | auth surface, no domain |

Also list: total domain specs, total page specs, skipped routes (with reasons), and the project-context merge target.

### A.3 — STOP for approval

End with: _"Reply `approve` to generate specs, or request scope/mapping changes."_ **Do not proceed to Phase B without explicit approval.**

---

## PHASE B — EXECUTE (after approval)

### Stage 1 — Domain specs (parallel fan-out)

For each planned domain card, spawn one writer. These write distinct files and are safe in parallel:

`Agent(subagent_type="domain-spec-writer", prompt="cardPath={migrationRoot}/domains/domain-{name}.md domain={name} persistence={confirmedPersistence} specPath=.specs/domain-{name}.yaml")`

Collect each writer's report (entity, PK, enums, persistence keys, gaps). **Domain specs MUST finish before Stage 2** — the page-spec cross-check reads them.

### Stage 2 — Page specs (parallel fan-out)

For each planned route card, spawn one writer:

`Agent(subagent_type="page-spec-writer", prompt="cardPath={migrationRoot}/routes/route-{slug}.md slug={slug} domain={owningDomain} domainSpecPath=.specs/domain-{owningDomain}.yaml classificationPath={migrationRoot}/components/_classification.md specPath=.specs/page-{slug}.yaml")`

Collect each writer's report — pay special attention to **Cross-check gaps** (page fields that don't resolve to a domain-spec field) and **Deferred** (surfaces Phase-1 page-spec can't express).

### Stage 3 — Project context merge

Merge `{migrationRoot}/context/PROJECT_CONTEXT.md` into `docs/PROJECT_CONTEXT.md` (create if absent; if present, append a clearly-headed section `## Migrated from {source-slug}` rather than overwriting). Do not duplicate existing content.

### Stage 4 — Field-resolution reconciliation

Aggregate all page-spec-writer **Cross-check gaps** into one table:

| Page spec          | Unresolved reference | Kind (column/filter/form/action) | Owning domain spec  | Suspected cause              |
| ------------------ | -------------------- | -------------------------------- | ------------------- | ---------------------------- |
| page-projects.yaml | `counts.tickets`     | column                           | domain-project.yaml | derived/rollup not in entity |

Every unresolved reference is annotated as a `# TODO:` in the emitted YAML (the writers already do this) AND listed here. **Never silently drop a referenced field.**

### Stage 5 — Ledger reconciliation

Cross-check the migration LEDGER: every domain at status `documented`/`signed-off` must now have a generated domain spec; every page-candidate route must have a generated page spec OR an explicit skip reason from Phase A. Produce `{migrationRoot}/_reconciliation-specs.md` listing:

- Domain specs written / domain cards skipped (with reason).
- Page specs written / route cards skipped (with reason).
- Verdict: **PASS** only if every domain card and every page-candidate route is accounted for (written or explicitly skipped). Otherwise **FAIL** with the list of unaccounted cards.

### Stage 6 — Final report

```markdown
# /migrate-to-specs — Result

**Migration root:** {migrationRoot}
**Verdict:** ✅ PASS | ❌ FAIL

## Domain specs ({n})

- [.specs/domain-{name}.yaml](...) — entity, persistence, N fields, N enums, N use cases

## Page specs ({n})

- [.specs/page-{slug}.yaml](...) — layout, N data sources, N components

## Skipped routes

- route-login.md — auth surface (no domain)

## Field-resolution gaps ({n})

- (table from Stage 4, or "none — all references resolve")

## Project context

- Merged into docs/PROJECT_CONTEXT.md

## Next steps

1. Review the generated specs (these are **draft v0** — `verified: false`; especially the `# TODO:` cross-check annotations).
2. Run `/mock-source-app` to build the source mock + capture screenshots and verify completeness against the live app (Gate #1) — this produces `SPEC-DELTAS.md`.
3. Run `/migrate-to-specs --reconcile` to fold the approved deltas in and promote the specs to **verified v1** (`verified: true`).
4. Per domain: run `/new-domain` (it auto-detects the `.specs/domain-{name}.yaml` via parse-domain-spec).
5. Per page: run `/migrate-page --mock` (build the interactive mock, seeded from the source fixtures), then `/migrate-page --wire` after the backend exists.
```

---

---

## RECONCILE MODE (`--reconcile`)

Run this flow **instead of** Phases A/B when invoked with `--reconcile`. It folds the
developer-approved gaps discovered during `/mock-source-app` (Gate #1) back into the specs,
promoting them from **draft v0** to **verified v1**.

### R.0 — Preconditions (read-only, verify before any write)

- `{slug}-migration/SPEC-DELTAS.md` exists and is marked **Gate #1 approved**. If it is absent or
  not approved, STOP and tell the developer to run `/mock-source-app` and approve Gate #1 first.
- The target draft specs exist under `.specs/` with `verified: false`.
- Read `.specs/schemas/domain-spec.schema.json` + `page-spec.schema.json` (edits must stay valid).

### R.1 — PLAN (read-only, STOP for approval)

Parse `SPEC-DELTAS.md` into a change set. Each delta is one of:

| Delta kind        | Spec edit                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| New field         | add `entity.fields[]` entry (type from the live value) to the domain spec |
| New enum value    | append to the field's enum list (+ label if the spec carries labels)      |
| Changed optionality | flip `required`/`optional` on the field per live evidence                |
| Computed/joined field | add the field + a `# derived:` note describing the source rollup       |
| New page state    | add the state to the page spec's states/dataSources where expressible     |

Present the full edit table: `SPEC-DELTAS.md` row → target spec file → exact field/enum change.
Show which specs will flip to `verified: true`. End with: _"Reply `approve` to apply the reconcile
edits, or adjust the mapping."_ **Do not edit any spec without approval** — this is a separate
developer judgment from the Gate #1 completeness approval.

### R.2 — APPLY (after approval)

- Apply each approved edit to the owning spec (domain spec for fields/enums; page spec for states).
- Resolve any `# TODO:` cross-check annotation that a delta now satisfies (remove the TODO).
- Re-run the field-resolution cross-check (Phase B Stage 4) so page references still resolve.
- Flip the header of every reconciled spec: `status: verified`, `verified: true`, and stamp
  `verifiedAgainst: live-app` (or `storybook-fallback`) + the date.
- Validate every edited spec against its JSON Schema. Fix violations before reporting.

### R.3 — Report

```markdown
# /migrate-to-specs --reconcile — Result

**Migration root:** {migrationRoot}   **Source of truth:** SPEC-DELTAS.md (Gate #1 approved)

## Specs promoted to verified v1 ({n})
- domain-{name}.yaml — +{f} fields, +{e} enum values, {o} optionality flips → verified:true

## Deltas applied ({n}) / deferred ({m})
- (table: delta → spec → change, plus any delta that could not be expressed yet + reason)

## Cross-check
- All page references resolve: ✅ | remaining TODOs: {list}

## Next
1. Review the YAML diffs (verified specs are now the build contract).
2. Run `/migrate-build-ui` then `/migrate-page` against the verified specs.
```

---

## Constraints

- This prompt writes ONLY `.specs/*.yaml` (via the writer subagents) and `docs/PROJECT_CONTEXT.md`. No production code.
- Domain specs are generated BEFORE page specs (the cross-check depends on them).
- The field-resolution cross-check is mandatory and gap-surfacing — unresolved references are annotated + reported, never dropped.
- **Generate mode emits draft v0** (`status: draft`, `verified: false`). Specs become `verified: true` ONLY via `--reconcile` after Gate #1 approval — never silently.
- **Reconcile mode requires a Gate #1-approved `SPEC-DELTAS.md`** and its own approval gate (R.1); it is a distinct developer judgment from the completeness sign-off.
- Every emitted spec MUST validate against its schema (the writers self-validate + `Bash`; if any spec has errors, mark the run PARTIAL and list them).
- Both `/new-domain` and `/migrate-page` consume the same YAML — do not branch the output by downstream consumer.
