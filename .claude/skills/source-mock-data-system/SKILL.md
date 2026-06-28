---
name: source-mock-data-system
description: Build a data-layer mock for a SOURCE app being migrated, so it boots with rich deterministic data and can be screenshotted route-by-route without a live backend. Use this when generating the mock for a migration (the /mock-source-app prompt), refactoring an existing source mock onto shared fixtures, or adding a new data-layer adapter recipe (Supabase, REST/fetch, GraphQL/Apollo, Firebase). Codifies the seam-swap pattern, the four adapter recipes, the DTO-shaped fixture contract, the mock-data detail standard, and the capture + live-app verification procedure.
---

# Source Mock Data System

This skill builds a **mock data layer for the SOURCE app** of a migration. The mock lets the
source app boot with **rich, deterministic data and no live backend**, so every route and every
UI state can be screenshotted and compared against the live app. The screenshots and the shared
fixtures become the visual + structural acceptance references the downstream `/migrate-page` and
`/migrate-build-ui` builders consume.

> **Where this runs:** in the **SOURCE repo** (e.g. `d:\mma-flow`), NOT the template repo.
> The skill itself lives in the template; the artifacts it produces are written into the source
> repo's `src/mock/` and copied into `{slug}-migration/` as migration artifacts.

## Why this exists (the problem it solves)

`/migrate-page` previously built pages from spec YAML alone — a flat field list. From that it had
to **guess** layout, density, state coverage, and computed fields, so pages came out wrong. This
mock system fixes the root cause:

1. **Completeness verification.** Booting the source app on mock data and comparing it side-by-side
   with the **live app** is the only way a developer can spot missing data, missing states, and
   missing/computed fields. Source code alone cannot reveal real enum coverage, real optionality,
   or computed/joined fields.
2. **Visual + structural reference.** Screenshots (`*.png`) and DOM dumps (`*.dom.json`) per
   route × state give the page builder a concrete target instead of a guess.
3. **Shared fixtures.** The same DTO-shaped fixture renders on BOTH the source mock and the
   rebuilt destination page, making automated parity diffing trustworthy.

## The #1 failure lesson — preserve REAL IDs through every handler

The single most common bug: a mock RPC/endpoint handler **re-indexes entities sequentially**
(`idx + 1`) while the consuming UI keys on the **real** entity id. Result: epics/tickets render
against the wrong key and the page silently breaks.

> **Rule:** every mock handler — query builder, RPC, REST endpoint, GraphQL resolver — must return
> the **exact real id** of each entity from the fixtures, never a positional index. Computed
> counts (e.g. `feDoneCount`) must be **derived from the fixture rows**, never hardcoded to 0.

---

## 1. The seam-swap pattern (universal)

Every data layer has exactly ONE module the rest of the app imports to talk to the backend. You
**swap that one module** behind an env flag, and the bundler tree-shakes the mock out of production.

```ts
// src/integrations/{layer}/client.ts  — the seam
const IS_MOCK = import.meta.env.VITE_MOCK === 'true'; // Vite
// const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === 'true'; // Next
import { realClient } from './real-client';
import { mockClient } from '@/mock/mock-client';

export const client = IS_MOCK
  ? (mockClient as unknown as typeof realClient)
  : realClient;
```

Activation is mode-driven, never a code edit:

- **Vite:** `.env.mock` with `VITE_MOCK=true`; run `vite --mode mock --port 8081`.
- **Next:** `.env.mock` / `NEXT_PUBLIC_MOCK=true`; `next dev` with the env loaded.
- **CRA:** `REACT_APP_MOCK=true npm start`.

Add a `dev:mock` script so the command is one word.

### Files the seam-swap produces (in the source repo)

```
src/mock/
  fixtures/            ← DTO-shaped JSON, the single source of truth (§3)
    {entity}.json
  data.ts              ← loads fixtures, exposes getMockTableData()/helpers
  mock-client.ts       ← the data-layer adapter (one of the 4 recipes in §2)
  screenshots/         ← produced by the capture pass (§5)
    MANIFEST.md
    capture.spec.ts
    {route}/{state}-{viewport}-{theme}.png
    {route}/{state}-{viewport}-{theme}.dom.json
.env.mock
```

---

## 2. The four data-layer adapter recipes

Pick the recipe matching the source's data layer (auto-detect from imports / `package.json`).

### 2A. Supabase (PostgREST query builder + RPC + auth + storage)

The hardest because the client is a **fluent query builder**. Mock a `MockQueryBuilder` that
implements the chainable surface and resolves against fixtures.

- **Chainable, return `this`:** `.select .eq .neq .in .ilike .is .not .gte .lte .gt .lt .or .order .range .limit .insert .update .upsert .delete`.
- **Terminal:** `.maybeSingle()`, `.single()`, and a thenable `.then()` so `await query` resolves.
- **Joins:** parse PostgREST embed syntax (`*, author:users(*)`) with a `JOIN_FK` map
  (`alias → { table, localKey, fkKey }`) and resolve nested selections against fixtures.
- **RPC:** a `handleRpc(fnName, params)` switch — **return the EXACT shape the real RPC returns**,
  with real ids and derived counts (see the #1 failure lesson).
- **auth:** `getSession`, `onAuthStateChange` (fire `SIGNED_IN` via `setTimeout(…, 0)`), `getUser`,
  `signOut`, `signInWithPassword`, `updateUser`, `resetPasswordForEmail`.
- **storage / functions / realtime channels:** no-op stubs returning plausible shapes
  (`getPublicUrl`, `createSignedUrl`, `invoke`, channel subscribe/unsubscribe).

Export `mockSupabase = { from, rpc, channel, removeChannel, auth, storage, functions }`.

### 2B. REST / fetch

Intercept `globalThis.fetch` (or the Axios instance) and route by URL + method against fixtures.

```ts
const ROUTES: Array<{ method: string; pattern: RegExp; handler: (m: RegExpMatchArray, body?: unknown) => unknown }> = [
  { method: 'GET', pattern: /\/api\/tickets$/, handler: () => getMockTableData('tickets') },
  { method: 'GET', pattern: /\/api\/tickets\/(?<id>[^/]+)$/, handler: (m) => findById('tickets', m.groups!.id) },
  // ...
];
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  const match = ROUTES.find((r) => r.method === method && r.pattern.test(url));
  if (!match) return realFetch(input, init); // pass-through for assets
  const body = init?.body ? JSON.parse(init.body as string) : undefined;
  const data = match.handler(url.match(match.pattern)!, body);
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
```

Preserve real ids; derive counts from rows.

### 2C. GraphQL / Apollo

Provide a mock `ApolloLink` (`MockLink`) that resolves operations by name against fixtures, or use
`@apollo/client/testing` `MockedProvider` with a `mocks` array. Prefer a single `MockLink` so any
query works without enumerating every variable combination:

```ts
import { ApolloLink, Observable } from '@apollo/client';
export const mockLink = new ApolloLink((operation) => new Observable((observer) => {
  const data = resolveOperation(operation.operationName, operation.variables); // → fixtures
  observer.next({ data });
  observer.complete();
}));
```

Match the exact `__typename` + field selection the UI expects; preserve real ids.

### 2D. Firebase / Firestore

Shim the firestore API surface used by the app: `collection`, `doc`, `getDocs`, `getDoc`,
`query`, `where`, `orderBy`, `onSnapshot` (fire once with fixtures then no-op), `addDoc`,
`updateDoc`, `deleteDoc`. Return `{ docs: [{ id, data: () => row }] }`-shaped results. Mock
`getAuth().onAuthStateChanged` to emit a stable mock user.

---

## 3. The fixture contract (shared, DTO-shaped)

Fixtures are the **single source of truth** both the source mock and the destination page import.

- **Shape = the destination DTO** (camelCase, the shape declared in `.specs/domain-{name}.yaml`
  `entity.fields`), NOT the source DB row shape. The source mock maps DTO → its own row shape
  internally where needed. This makes the source-mock ↔ destination parity diff trustworthy.
- **One file per entity:** `src/mock/fixtures/{entity}.json` — a plain JSON array of rows.
- **Canonical copy lives in the source repo** `src/mock/fixtures/`; copied into `{slug}-migration/fixtures/`
  as a migration artifact during capture.

### Two-pass spec relationship (why fixtures bootstrap, then verify, the spec)

| Spec pass | When | Fixture role |
| --------- | ---- | ------------ |
| **v0 draft** (`verified:false`) | after `/migrate-to-specs` | fixture SKELETON generated from v0 `entity.fields` |
| **enrich vs live app** | during `/mock-source-app` | fill rows for every real status/state/computed field the live app shows; record each gap in `SPEC-DELTAS.md` |
| **v1 final** (`verified:true`) | after `/migrate-to-specs --reconcile` | fixture is the verified ground truth folded back into the spec |

If no domain spec exists yet, hand-author the fixture to the detail standard below and reconcile
to the spec later. **Source code is enough only for the v0 skeleton — never for the final fixture.**

---

## 4. The mock-data detail standard

A screenshot of a page that only ever shows one empty state teaches nothing. Fixture richness is
what makes screenshots and parity diffs valuable.

For **every entity**:

- **≥ 3 rows**, spanning **every status / enum value** at least once (incl. rare/edge states).
- **Stable, structured ids** — readable and deterministic (e.g. `aaaaaaaa-...` users,
  `bbbbbbbb-...` projects, `cccccccc-...` statuses). Never random per-run.
- **FK referential integrity** — every foreign key points at a row that exists in another fixture.
- **Computed / joined / denormalized fields present and correct** — derive counts, rollups, and
  joined arrays from the actual rows (this is the field class source code hides).

For **every route**, the fixtures must make these UI states reachable:

- **empty** (e.g. an archived/empty project), **single** row, **many** rows.
- **loading** and **error** where the UI distinguishes them.
- any route-specific **edge cases** (blocked status, over-budget, missing avatar, etc.).

For **every RPC / endpoint / resolver handler**: return the **exact real shape** the consumer
expects, with **real ids** and **derived counts**.

---

## 5. Capture + live-app verification procedure

### 5.1 The manifest

`src/mock/screenshots/MANIFEST.md` enumerates every shot — one row per route × state × viewport × theme:

| route | state | viewport | theme | deep-link | wait-for |
| ----- | ----- | -------- | ----- | --------- | -------- |
| projects-client | populated | desktop | light | `/projects/{id}/client` | network-idle |
| projects-client | populated | mobile | dark | `/projects/{id}/client` | network-idle |
| projects-client | empty | desktop | light | `/projects/{emptyId}/client` | `[data-empty]` |

Deep-links must target fixture ids that produce the named state (a populated project id for
`populated`, an archived/empty id for `empty`).

### 5.2 The capture spec

`src/mock/screenshots/capture.spec.ts` (Playwright) iterates the manifest. Per row it:

1. sets the viewport + theme (toggle `class="dark"` on `<html>` if the app supports it),
2. navigates the deep-link against the booted mock app (`localhost:8081`),
3. waits for `wait-for` (network-idle or a selector),
4. writes BOTH artifacts:
   - `{route}/{state}-{viewport}-{theme}.png` — visual reference,
   - `{route}/{state}-{viewport}-{theme}.dom.json` — structural reference: rendered table
     columns, badge labels, section headings, row counts, empty-state copy. The DOM dump is the
     **text-safe** target a non-multimodal builder can always consume.

Run via `npx playwright test src/mock/screenshots/capture.spec.ts` after booting `dev:mock`.

### 5.3 The live-app enrichment + SPEC-DELTAS

While building fixtures, open the **live deployed source app** and walk every route/state. For each
field/enum/state the live app shows that the v0 spec skeleton lacks, **add it to the fixture** and
record it in `{slug}-migration/SPEC-DELTAS.md`:

```markdown
# SPEC-DELTAS — verified against live app

| Entity  | Delta                              | Kind     | Spec v0 had it? | Proposed spec edit                 |
| ------- | ---------------------------------- | -------- | --------------- | ---------------------------------- |
| tickets | status value `BLOCKED`             | enum     | no              | add to status enum                 |
| tickets | `feDoneCount` (computed)           | field    | no              | add field, type int (derived)      |
| tickets | `assigneeAvatars` (joined)         | field    | no              | add field, type string[]           |
```

This file is the input to `/migrate-to-specs --reconcile`.

### 5.4 Developer approval gate (Gate #1) — completeness

This is the central human checkpoint. Present, **side by side**, the **live app** and the
**source-mock app**, per route/state, plus `SPEC-DELTAS.md`. The developer confirms:

- no row, status, state, or field present in the live app is missing from the mock,
- empty / single / many / error states are covered,
- computed/joined fields render (not zeros/blanks).

**Approve → fixtures freeze, deltas become verified ground truth.** Reject → enrich, re-capture,
re-present. The workflow does not proceed without approval.

> If no live app is reachable, fall back to live-vs-Storybook / route-cards and flag lower
> confidence at the gate.

---

## 6. Verification checklist (before declaring the mock done)

- [ ] App boots on `dev:mock` with no console errors on every route in the manifest.
- [ ] Every entity fixture has ≥ 3 rows covering every status/enum.
- [ ] Every route reaches empty / single / many (+ error where applicable).
- [ ] Every RPC/endpoint/resolver returns the real shape with **real ids** + derived counts.
- [ ] FK integrity holds across fixtures.
- [ ] `capture.spec.ts` produced a `.png` AND a `.dom.json` for every manifest row.
- [ ] `SPEC-DELTAS.md` lists every field/enum/state the live app revealed beyond spec v0.
- [ ] Gate #1 approved by the developer (live app vs mock).
- [ ] Fixtures + screenshots copied into `{slug}-migration/`.

---

## Anti-patterns (never do these)

- ❌ Sequential/positional ids in handlers instead of real fixture ids (the #1 failure).
- ❌ Hardcoding computed counts to 0 instead of deriving from rows.
- ❌ Editing source files to toggle the mock (always env-mode driven via the seam).
- ❌ Source-shaped (snake_case) fixtures — they break the parity diff. Fixtures are DTO-shaped.
- ❌ One-row fixtures — they make screenshots and parity diffs worthless.
- ❌ Capturing only `.png` and skipping `.dom.json` — the structural dump is what text-only
  builders consume.
- ❌ Trusting spec v0 as final — it is code-inferred and unverified until Gate #1 + reconcile.
