---
description: "Build ONE webapp page directly in its production location apps/webapp/src/app/(protected)/{route}/ from a page-spec YAML, in two passes. Pass 1 (--mock) produces a real page + an INTERACTIVE mock adapter (_data/{domain}.adapter.ts backed by useState: filters narrow rows, form submit appends a row) verifiable before the backend exists, with auth bypassed via NEXT_PUBLIC_MOCK_PREVIEW. Pass 2 (--wire) rewrites ONLY the adapter to re-export the real @old-st/client-common hooks — page.tsx stays byte-identical. Replaces the retired migration-preview surface. Spawns the migration-page-builder subagent. USE WHEN the user says 'build this page', 'migrate-page', 'build the projects page mock', or 'wire the projects page to the real API'."
---

# Migration Page — Staged Build (mock → wire)

You build one webapp page from its `.specs/page-{slug}.yaml` (produced by `/migrate-to-specs`). Unlike the retired preview surface, the page is built **once, in its real `(protected)/{route}/` location**. The mock-vs-real switch lives in a single swappable `_data/{domain}.adapter.ts`, so `page.tsx` never changes between passes.

**Two passes, run separately:**

- **`--mock` (pass 1):** real page + interactive mock adapter. Verifiable immediately with `NEXT_PUBLIC_MOCK_PREVIEW=true` (auth bypass — see below). No backend required.
- **`--wire` (pass 2):** rewrite ONLY the adapter to use real `@old-st/client-common` hooks. Runs the parse-page-spec **Mode-A gate** — if hooks/schemas are missing, STOPS with `needs_backend` instead of stubbing.

**Do NOT call any tools or write code until Phase 0 is complete.**

---

## Phase 0 — Interview

Ask in a single structured message and wait:

1. **Mode?** `--mock` (pass 1) or `--wire` (pass 2). **Required.**
2. **Page spec path?** e.g. `.specs/page-projects.yaml`. Default: if the user named a route, resolve `page-{route}.yaml`.
3. **(--wire only) Confirm the backend is deployed/available** for this domain (the domain's `/new-domain` workflow ran and `client-common` hooks exist). If unsure, the Mode-A gate will catch it.
4. **(--mock only) Reference screenshots folder?** The source-mock capture set from `/mock-source-app`. Default: `{slug}-migration/screenshots/{route}/`. Used as the **visual + structural acceptance target** (`{state}.png` + `{state}.dom.json`). If none exists, the mock is built spec-only (lower fidelity) — note this.
5. **(--mock only) Shared fixtures?** The canonical DTO-shaped fixtures from `/mock-source-app`. Default: `{slug}-migration/fixtures/`. The mock adapter is **seeded from these exact fixtures** (same data the source-mock used) so `/migrate-verify` can diff the two on identical input.

**Do not proceed until questions 1–2 are answered.**

---

## Phase 0.5 — Pre-flight (parallel, read-only)

- Read the page spec at `pageSpecPath` and resolve its `domain`.
- Read the owning domain spec `.specs/domain-{domain}.yaml` (the mock SHAPE source).
- Read `.claude/skills/parse-page-spec/SKILL.md` (Mode-A gate definition for `--wire`).
- `Glob("apps/webapp/src/app/(protected)/{route}")` — detect an existing build (re-run vs first build).
- (--mock) Confirm the MOCK_PREVIEW guard exists in `apps/webapp/src/app/(protected)/layout.tsx`. If absent, add it (skip auth redirect when `process.env.NEXT_PUBLIC_MOCK_PREVIEW === 'true'` AND `process.env.NEXT_PUBLIC_STAGE === 'local'`).
- (--mock) `Glob` the reference screenshots folder (`{slug}-migration/screenshots/{route}/`) and the fixtures folder (`{slug}-migration/fixtures/`). Read the `{state}.dom.json` files (structural target: columns, row counts, badge text, headings, empty-state copy) and note the `{state}.png` files (visual target). Read the entity fixture JSON whose rows seed this page. If either folder is absent, flag that the mock will be spec-only.

Wait for all to return.

---

## Phase 1 — Build

### Mode `--mock`

`Agent(subagent_type="migration-page-builder", prompt="mode=--mock pageSpecPath={pageSpecPath} domainSpecPath=.specs/domain-{domain}.yaml route={route} domain={domain} fixturesPath={slug}-migration/fixtures/ referenceScreenshots={slug}-migration/screenshots/{route}/")`

The subagent:

1. Derives the mock fixture SHAPE from the domain spec's `entity.fields`, **seeded with the actual rows from `{slug}-migration/fixtures/`** (the same data the source-mock rendered) so structure + values match. Falls back to synthesized rows only if no fixtures exist.
2. Writes `_data/{domain}.adapter.ts` — hook-shaped exports backed by `useState` so the page is **interactive** (filters narrow rows, form submit appends a row, status actions mutate a row).
3. Writes `page.tsx` (thin orchestrator) + domain components + `error.tsx` + `loading.tsx`, **matching the structural target in each `{state}.dom.json`** (same columns/headings/badges/empty-state copy) and the visual reference in `{state}.png`. `page.tsx` imports the adapter, never `@old-st/client-common`.
4. Builds webapp and reports.

After it returns, tell the developer how to view it:

```
Set NEXT_PUBLIC_MOCK_PREVIEW=true and NEXT_PUBLIC_STAGE=local in .env.local,
then `pnpm nx serve webapp` and open /{route}.
The auth redirect is bypassed only while both flags are set.
```

### Mode `--wire`

`Agent(subagent_type="migration-page-builder", prompt="mode=--wire pageSpecPath={pageSpecPath} domainSpecPath=.specs/domain-{domain}.yaml route={route} domain={domain}")`

The subagent:

1. Runs the parse-page-spec **Mode-A gate** — every `dataSource.hook` must exist in `client-common` and every form `schema` in `@old-st/contracts/{domain}`. Missing → returns `needs_backend` and STOPS.
2. Rewrites ONLY `_data/{domain}.adapter.ts` to re-export the real hooks. `page.tsx` + components stay identical.
3. Runs `nx test webapp` + `nx build webapp` and reports.

If the subagent returns `needs_backend`, surface the missing hooks/schemas and instruct the developer to run `/new-domain` (or the relevant backend workflow) for `{domain}` first, then re-run `/migrate-page --wire`.

---

## Phase 2 — Validate & report

- Confirm the subagent's build (and test, for `--wire`) passed.
- `Bash` on the page + adapter + components.
- **(--mock, when reference screenshots exist) Self-screenshot check:** boot the webapp in MOCK_PREVIEW mode and capture the page in each state, then compare against the reference `{state}.dom.json` (structure) + `{state}.png` (visual). Report any structural divergence (wrong columns, row count, missing empty-state copy) as a fix-now item — this is a fast local preview of what `/migrate-verify` (Gate #2) will assert formally.
- Final report:

```markdown
# /migrate-page {mode} — {route}

**Page spec:** {pageSpecPath} **Domain:** {domain}
**Status:** ✅ PASS | ⚠️ PARTIAL | 🔌 needs_backend | ❌ FAIL

## What changed

- (from the subagent report)

## How to view (--mock)

- NEXT_PUBLIC_MOCK_PREVIEW=true + NEXT_PUBLIC_STAGE=local + nx serve webapp → /{route}

## Next step

- --mock done → run /migrate-page --wire after the {domain} backend exists.
- --wire done → remove/leave NEXT_PUBLIC_MOCK_PREVIEW=false; the page now uses the real API.
```

---

## Constraints

- The page is built in its REAL `(protected)/{route}/` location — never `migration-preview/`.
- The ONLY file that differs between `--mock` and `--wire` is `_data/{domain}.adapter.ts`. `page.tsx` is byte-identical across passes.
- Mock state MUST be interactive (useState) — never a frozen array. See `.claude/skills/interactive-mock-state/SKILL.md`.
- `NEXT_PUBLIC_MOCK_PREVIEW` is an env flag, NOT code that gets deleted. The guard stays permanently in the protected layout; the developer toggles `.env.local`. Production never sets it; the API re-validates every request (layout auth is UX, not security — Rule #23e).
- `--wire` never stubs missing hooks — it stops with `needs_backend`.
