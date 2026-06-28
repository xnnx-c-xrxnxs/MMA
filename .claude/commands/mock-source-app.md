---
description: "Build a data-layer mock for the SOURCE app of a migration so it boots with rich deterministic fixtures and no live backend, then capture a screenshot + DOM-dump of every route × state and verify completeness against the LIVE app. Produces src/mock/fixtures/*.json (DTO-shaped), the mock client/seam, .env.mock, a dev:mock script, a Playwright capture spec, screenshots/{route}/{state}.png + .dom.json, MANIFEST.md, and SPEC-DELTAS.md. Three phases: PLAN (interview) → BUILD+ENRICH → 🚦 GATE #1 (developer compares live app vs mock and approves completeness). Bridges /migrate-to-specs (draft spec v0) → /migrate-to-specs --reconcile (verified spec v1). USE WHEN the user says 'mock the source app', 'mock-source-app', 'build the source mock', 'screenshot every route of the source', or after /migrate-to-specs produces a draft spec."
---

# Mock Source App — Fixtures, Capture & Live-App Verification

You build a **mock data layer for the SOURCE app** of a migration so it runs with rich,
deterministic data and **no live backend**, then you **screenshot and DOM-dump every route in every
state** and have the developer verify completeness against the **live app**. The fixtures and
screenshots become the acceptance references that `/migrate-build-ui` and `/migrate-page` consume,
and the discovered gaps (`SPEC-DELTAS.md`) feed `/migrate-to-specs --reconcile` to promote the
draft spec (v0) to a verified spec (v1).

> **You write into the SOURCE repo** (e.g. `d:\old-st-flow`), not the template. The only template
> artifact you touch is copying fixtures + screenshots into `{slug}-migration/`.

**Read `.claude/skills/source-mock-data-system/SKILL.md` before Phase B — it is the authoritative
reference for the seam-swap pattern, the four adapter recipes, the fixture contract, the mock-data
detail standard, and the capture/verify procedure.**

**Do NOT call any tools or write any files until Phase A is complete and approved.**

---

## Phase A — PLAN (interview, read-only)

Ask in a single structured message and wait for answers.

1. **Source repo absolute path?** e.g. `d:\old-st-flow`. **Required.**
2. **Source slug / migration folder?** e.g. `old-st-flow` → `old-st-flow-migration/`. Default: auto-detect the single `*-migration/` folder; if none, derive from the source folder name.
3. **Data layer?** `supabase` | `rest` | `graphql` | `firebase`. Default: **auto-detect** from the source `package.json` + `src/integrations/**` imports; confirm the detection with the developer.
4. **Build tool / dev command?** Default: auto-detect (Vite → `vite --mode mock --port 8081`, Next → `next dev`, CRA → `react-scripts start`). Note: **use `npx`, not bun**, if the package manager binary is not on PATH.
5. **Router?** Default: auto-detect (`react-router-dom`, Next pages/app, etc.) — used to enumerate routes for the manifest.
6. **Is the LIVE source app reachable?** A URL (deployed/staging), or "no". This decides the Gate #1 reference: live app (high confidence) vs Storybook/route-cards fallback (lower confidence).
7. **Screenshot scope?** viewports (default `desktop` + `mobile`), themes (default `light`; add `dark` if the source supports it), and route set (default: all navigable routes from §5; or a named subset).
8. **Draft spec available?** Path to `.specs/domain-*.yaml` (spec v0). Default: auto-detect. If none exist, fixtures are hand-authored to the detail standard and reconciled later.

**Do not proceed until questions 1 is answered (and 3 confirmed).**

---

## Phase A.5 — Pre-flight (parallel, read-only)

Run in parallel:

- `Glob` the source repo root + `src/`; locate the data-layer seam module (`src/integrations/{layer}/client.ts` or equivalent).
- Read `package.json` (scripts, deps) to confirm data layer + dev command + whether Playwright is installed.
- Read any existing `src/mock/**` (refactor target — don't clobber working logic; refactor onto fixtures).
- Read the draft domain spec(s) `.specs/domain-*.yaml` for the fixture SHAPE (v0 `entity.fields`).
- Enumerate routes from the router config (for the manifest).
- `Glob` the `{slug}-migration/` folder (artifact destination).

Wait for all to return, then present the **build plan**:

- Detected data layer + chosen adapter recipe.
- Entities → fixture files to create, with target row counts + status/enum coverage.
- Routes → manifest rows (route × state × viewport × theme), with the deep-link + state-producing fixture id for each.
- Whether the live app is reachable (Gate #1 reference).
- The seam file + `.env.mock` + `dev:mock` script + capture spec to be written.

End Phase A with: _"Reply `approve` to build the mock + capture, or adjust the plan."_ **Do not write any files without approval.**

---

## PHASE B — BUILD + ENRICH (after approval)

### B.1 — Fixtures (skeleton from spec v0)

For each entity, create `src/mock/fixtures/{entity}.json` (DTO-shaped, camelCase) seeded from the
draft spec's `entity.fields`. Apply the **mock-data detail standard** (skill §4): ≥ 3 rows, every
status/enum, stable structured ids, FK integrity.

### B.2 — Enrich against the LIVE app (ground truth)

Open the live app (or fallback) and walk every route/state. For every status value, optional field,
empty/edge state, and **computed/joined/denormalized field** the live app reveals that the v0
skeleton lacks:

- add it to the fixture (with correct derived values), and
- record it in `{slug}-migration/SPEC-DELTAS.md` (skill §5.3 table format).

This is where the spec's code-inferred blind spots are corrected. Source code alone is insufficient.

### B.3 — Wire the mock

Following the chosen adapter recipe (skill §2):

- Write `src/mock/data.ts` — load fixtures, expose `getMockTableData(table)` + helpers; **preserve
  real ids**, derive counts from rows.
- Write `src/mock/mock-client.ts` — the adapter (query builder / fetch interceptor / Apollo link /
  firestore shim) resolving against `data.ts`. RPC/endpoint/resolver handlers return the **exact
  real shape with real ids** (the #1 failure lesson).
- Add the seam swap in the data-layer client module (env-flag, never a hard edit).
- Mock auth so the app is "signed in" on boot (stable mock user/session).
- Create `.env.mock` (`VITE_MOCK=true` / framework equivalent) and add a `dev:mock` script to
  `package.json`. Add Playwright as a devDep + a `mock:capture` script if absent.

After wiring, boot `dev:mock` and confirm every manifest route renders with no console errors.
Run `Bash` on the new mock files; fix before continuing.

### B.4 — Capture (screenshots + DOM dumps)

Write `src/mock/screenshots/MANIFEST.md` (columns: route | state | viewport | theme | deep-link |
wait-for) and `src/mock/screenshots/capture.spec.ts` (skill §5.2). Run it against the booted mock.
Per manifest row it writes BOTH:

- `{route}/{state}-{viewport}-{theme}.png` (visual reference), and
- `{route}/{state}-{viewport}-{theme}.dom.json` (structural reference: columns, badge labels,
  headings, row counts, empty-state copy).

### B.5 — Copy artifacts into the migration folder

Copy `src/mock/fixtures/` → `{slug}-migration/fixtures/` and `src/mock/screenshots/` →
`{slug}-migration/screenshots/`. `SPEC-DELTAS.md` already lives in `{slug}-migration/`.

---

## PHASE C — 🚦 GATE #1 (HALT for developer approval)

This is the central human checkpoint: **mock completeness vs the live app**.

Present a single review document:

- The route × state coverage table (manifest), each row linking its `.png` + `.dom.json`.
- `SPEC-DELTAS.md` — everything the live app revealed beyond spec v0.
- A side-by-side instruction: open the **live app** and the **mock app** (`localhost:8081`) at each
  manifest deep-link and confirm parity of data, states, and fields.

Ask the developer to confirm:

1. No row, status, state, or field in the live app is missing from the mock.
2. Empty / single / many (+ error) states are covered for every route.
3. Computed/joined fields render correctly (no stray zeros/blanks).

End with: _"Reply `approve` to freeze fixtures as verified ground truth (then run
`/migrate-to-specs --reconcile`), or list gaps to fix and I'll enrich + re-capture."_

**On approve:** fixtures + `SPEC-DELTAS.md` are frozen as the verified reference. **On reject:** loop
back to B.2 (enrich) → B.4 (re-capture) → Phase C.

**Do not proceed past this gate without explicit approval.**

---

## Final report (after approval)

```markdown
# /mock-source-app — Result

**Source repo:** {path}   **Data layer:** {layer}   **Live app:** {url | fallback}
**Gate #1:** ✅ approved

## Fixtures ({n} entities)
- src/mock/fixtures/{entity}.json — {rows} rows, statuses: {...}

## Screenshots ({n} shots)
- {route}/{state}-{viewport}-{theme}.png + .dom.json  (manifest: {link})

## Spec deltas ({n})
- (SPEC-DELTAS.md summary — fields/enums/states the live app revealed beyond spec v0)

## Next steps
1. Run `/migrate-to-specs --reconcile` to fold SPEC-DELTAS.md into the spec (v0 → verified v1).
2. Run `/migrate-build-ui` (composite-builder consumes the screenshot crops).
3. Run `/migrate-page --mock` (seeds the adapter from the SAME fixtures, targets the .dom.json + .png).
4. Run `/migrate-verify` to assert source-mock ↔ destination DOM-structure parity (Gate #2).
```

---

## Constraints

- Writes into the **SOURCE repo** (`src/mock/**`, `.env.mock`, `package.json` scripts) + copies
  artifacts into `{slug}-migration/`. Never edits the template's `apps/` or `packages/`.
- Fixtures are **DTO-shaped** (camelCase target shape) — never source DB row shape.
- Every handler preserves **real entity ids** and derives counts from rows.
- The mock is activated by **env mode**, never a source-file toggle.
- Capture emits **both** `.png` and `.dom.json` per manifest row.
- Gate #1 is mandatory and halting — the spec stays `verified:false` until the developer approves
  completeness AND `/migrate-to-specs --reconcile` runs.
- Idempotent: re-running detects existing fixtures/mock/screenshots and updates rather than duplicating.
