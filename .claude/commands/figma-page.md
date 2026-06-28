---
description: "Generate ONE Next.js page in apps/webapp/ from a Figma frame URL. Composes existing @mma/ui primitives; recursively invokes /figma-component for any missing primitive. USE WHEN the user pastes a Figma URL pointing to a screen / frame, or says 'port this Figma dashboard', 'build this Figma screen', 'generate page from this Figma URL'."
---

# Figma → Next.js Page (single screen)

You are orchestrating the generation of **one** Next.js page (with its domain components) from a Figma frame. For a single primitive use `figma-component.md`; for whole files use `figma-import.md`.

**Do NOT call any tools or write any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Figma URL?** (page-level frame — not a single component instance)
2. **Screen name?** (e.g. "Dashboard", "Project Detail", "Reports") — informs file naming
3. **Route path?** (e.g. `/dashboard`, `/projects/[projectId]`, `/reports`)
4. **Public or protected?** (almost always protected — goes under `apps/webapp/src/app/(protected)/`)
5. **Which domain(s) does this screen pull data from?** (e.g. "users + orders")
6. **Should it appear in the sidebar?** (default yes)
7. **Forms involved?** (yes/no — if yes, which contract Zod schema)
8. **Status-driven action buttons?** (yes/no — if yes, which statuses → which actions)

### Auto-Detection

- If the named domain has hooks in `packages/client-common/src/hooks/`, surface that.
- If hooks are missing, surface that too — Phase 1 will need to add them via `webapp-api-client-hooks`.

**Do not proceed until questions 1–7 are answered (8 optional).**

---

## Phase 0.5 — Pre-flight Discovery (parallel)

### 0.5.0 — Load the Figma MCP tools (deferred — REQUIRED FIRST)

The Figma MCP tools (`mcp__figma__*`, `mcp__figma2__*`) are **deferred** — they appear in `availableDeferredTools` but are NOT callable until you load them.

1. `tool_search(query="figma mcp design metadata variables screenshot whoami")`.
2. Prefer `mcp__figma__*` over `mcp__figma2__*`. Use the alternate only if a specific call fails.
3. Confirm auth: `mcp__figma__whoami`.
4. **If the search returns no Figma tools, STOP** and tell the user the Figma MCP server is not configured. Do NOT fall back to a desktop app or to scraping.

### 0.5.1 — Read-only fan-out (after Figma tools are loaded)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: figma-to-ui-screen, figma-to-ui-component, webapp-new-page, webapp-api-client-hooks, webapp-form-with-validation, webapp-error-boundaries, webapp-skeleton-loading, webapp-toast-notifications")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=contracts+client-common, thoroughness=quick")`
- Read `packages/ui/src/index.ts` (inventory of existing primitives)
- Read `apps/webapp/src/app/globals.css` (Tailwind v4 hygiene check — confirm `@source` for `packages/ui/src` + the AUTO-GENERATED `@theme` / `.dark` sentinel block). Note: the legacy `.light` mirror block has been REMOVED — light/dark switching is runtime via `<ThemeToggle>` + `next-themes`.

Wait for all to return. Summarize what already exists, then proceed.

---

## Phase 1 — Pull the screen

### 1.0 — Parse the Figma URL (fail fast on bad input)

Figma tools require `fileKey` + `nodeId` as **separate params**, NOT the raw URL.

| URL pattern | `fileKey` | `nodeId` conversion |
|---|---|---|
| `figma.com/design/:fileKey/:name?node-id=:id` | as-is | replace `-` with `:` (e.g. `14-2` → `14:2`) |
| `figma.com/design/:fileKey/branch/:branchKey/:name` | use `branchKey` | same (`-` → `:`) |
| `figma.com/make/:makeFileKey/:name` | use `makeFileKey` | n/a |
| `figma.com/board/:fileKey/...` | FigJam — not a screen target. Ask for a design URL. |

If the URL has no `node-id`, this is wrong for a single-screen flow — ask the user to select the frame in Figma and re-paste. Do NOT guess.

### 1.1 — Fetch

Call in parallel (`mcp__figma__*`, fall back to `mcp__figma2__*`):

1. `mcp__figma__get_metadata({ fileKey, nodeId })` — full frame tree (sections, child frames, instance references)
2. `mcp__figma__get_screenshot({ fileKey, nodeId })` — visual reference (CRITICAL — keep mentally throughout). For tall pages (>~600px tall) request multiple shots of named sub-frames; the screenshot tool clamps output to ~1024×640.
3. `mcp__figma__get_design_context({ fileKey, nodeId })` — reference React + Tailwind (long for full screens — guidance only)
4. `mcp__figma__get_variable_defs({ fileKey, nodeId })` — tokens used

**STOP. Do not start coding. Move to decomposition.**

---

## Phase 2 — Decompose the screen

Inventory every distinct **instance** in the frame. Group by intent:

```
Header / Topbar
Sidebar Nav
Filters / Toolbars
Data sections (tables, lists, cards)
Forms / Modals
Actions (buttons, dropdowns)
Empty / Loading states
```

Produce a section table for the user:

```
| Section          | Composed of                                             |
|------------------|---------------------------------------------------------|
| Topbar           | Title (text) + Avatar + IconButton (notifications)      |
| Stats Row        | 4× StatCard (custom, page-local)                        |
| Recent Orders    | Card + Table + Badge + Button                           |
```

---

## Phase 3 — Primitive audit (KEY GATE)

For every **unique** primitive used in the inventory, check `packages/ui/src/index.ts`:

```
| Primitive       | In @mma/ui? | Action                        |
|-----------------|----------------|-------------------------------|
| Button          | ✅              | use existing                  |
| Card            | ✅              | use existing                  |
| Badge           | ✅              | use existing                  |
| StatCard        | ❌              | page-local (composes Card)    |
| DateRangePicker | ❌ DS           | INVOKE /figma-component first |
```

For each "INVOKE /figma-component" row:

1. **STOP** the page workflow
2. Identify the Figma component URL for that primitive (often a child instance of the screen frame, or in a separate library file)
3. Run the `figma-component.md` workflow for it
4. **Resume here once the primitive ships**

Page-local components (only used by this one screen) DO NOT go into `@mma/ui` — they live in `apps/webapp/src/components/{domain}/`.

---

## Phase 4 — Plan domain components

List the page-local components that will live in `apps/webapp/src/components/{domain}/`. Confirm with the user before generating.

Also identify:

- Which React Query hooks the page needs (existing or to-be-added)
- Whether forms are present (load `webapp-form-with-validation` later if so)
- Whether `loading.tsx` and `error.tsx` need to be added for the route segment

---

## Phase 5 — Hooks (only if missing)

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

If the page needs hooks not yet in `client-common`, add them now. Re-export from `packages/client-common/src/hooks/index.ts`.

Verify:

```powershell
pnpm nx build client-common
```

---

## Phase 6 — Compose the page

**Load skill:** `.claude/skills/figma-to-ui-screen/SKILL.md`
**Load skill:** `.claude/skills/webapp-new-page/SKILL.md`
**Load skill:** `.claude/skills/webapp-form-with-validation/SKILL.md` (only if Phase 0 Q7 = yes)

Then:

1. Create domain components in `apps/webapp/src/components/{domain}/*.tsx`
2. Create the page in `apps/webapp/src/app/(protected)/{route}/page.tsx` as a thin orchestrator
3. Wire React Query hooks
4. Wire forms with `react-hook-form` + Zod resolver from `@mma/contracts/{domain}`
5. Status-driven actions: import enum from `@mma/contracts/{domain}`, never hardcode strings
6. If sidebar entry needed: update `apps/webapp/src/components/layout/sidebar.tsx`

---

## Phase 7 — Loading + error boundaries

**Load skill:** `.claude/skills/webapp-error-boundaries/SKILL.md`
**Load skill:** `.claude/skills/webapp-skeleton-loading/SKILL.md`

Add to the route segment:

- `loading.tsx` — skeleton matching the shape of the rendered page
- `error.tsx` — Client Component rendering `<SegmentError>`

---

## Phase 8 — Toast feedback (only if mutations exist)

**Load skill:** `.claude/skills/webapp-toast-notifications/SKILL.md`

Wire success / error toasts on every mutation. The `<Toaster>` is already mounted globally — only need to call `toast.success()` / `toast.error()` from mutation `onSuccess` / `onError`.

---

## Phase 9 — Visual diff vs Figma (Design Preview + actual route)

Two independent runtime checks — both required because `nx build` cannot detect Tailwind v4 "compiles green, renders blank" failures:

### 9.1 — Design Preview page (any new/updated primitive)

If this workflow recursively invoked `/figma-component` for a missing primitive, that primitive must already be appended to the Design Preview surface at `apps/webapp/src/app/design-preview/` (Phase 5 of the component prompt scaffolds it on demand if missing). Verify it renders correctly there before checking the actual page — broken primitives are easier to diagnose in isolation than inside a complex composition.

### 9.2 — The page itself

Run the webapp locally:

```powershell
pnpm nx run webapp:dev
```

Open the route in a browser, toggle dark mode, compare to the Figma screenshot from Phase 1. Document any visual deltas; iterate.

**Symptoms and fixes:**

| Symptom | Likely cause |
|---|---|
| Primitive renders as 0×0 | `globals.css` missing `@source "../../../../packages/ui/src"` |
| Light mode renders dark | `next-themes` not mounted, or `<html>` missing `class="dark"` toggle from `<ThemeToggle>` |
| Wrong colors / silent fallback to muted | Token in `tokens.ts` not mirrored to `darkColors`, or `pnpm tokens:gen` not run after editing tokens |
| `loading.tsx` flashes incorrectly | Skeleton shape doesn't match rendered page |

---

## Phase 10 — Final verification

```powershell
pnpm nx run-many -t lint,build,test --projects=ui,client-common,webapp
```

Optionally suggest E2E coverage via `write-webapp-e2e-tests` skill (do not auto-generate — surface to user).

---

## When to escalate to a different prompt

| Symptom | Use instead |
|---|---|
| The URL points to a single component | `figma-component.md` |
| The URL points to a whole Figma file (multiple screens + a library) | `figma-import.md` |
| The screen requires a new mobile screen too | This prompt then `mobile-new-screen` skill |
