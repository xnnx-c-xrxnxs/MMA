---
description: "Bulk-import an entire Figma file (or page) into the codebase — generates ALL primitives + ALL screens in one orchestrated pass with classification (design-system vs page-local) and an explicit dry-run plan that the developer must approve before any file is written. USE WHEN the user says 'import this Figma file', 'bootstrap from this Figma URL', 'generate everything from Figma', 'paste a Figma file URL and build everything'."
---

# Figma File → Bulk Import

You are orchestrating a **bulk import** of a whole Figma file (or page) into the codebase. This is the broadest of the three Figma workflows — generates many primitives and many screens in one session. For a single primitive use `figma-component.md`; for a single screen use `figma-page.md`.

**This workflow is dangerous (touches 30+ files in one shot). It is split into two explicit phases that the developer MUST approve between:**

- **Phase A — PLAN (read-only)**: produces a Markdown table of every artifact to be created/updated. STOPS for approval.
- **Phase B — EXECUTE**: only runs after explicit user approval.

**Do NOT call any tools or write any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Figma URL?** (file root, or a specific page within the file — both supported)
2. **Component library structure?** The standard Figma design file uses **one page per component** (e.g. `↳ Button`, `↳ Badge`, `↳ Input Text`), each containing a single `COMPONENT_SET` with all variants (see [docs/figma-design-standards.md](docs/figma-design-standards.md)). Choose the structure that matches the Figma file:
   - **`multi-page`** *(default — matches the standard Figma reference file)* — each component lives on its own Figma page. The orchestrator auto-discovers all pages whose names start with `↳ ` and contain a `COMPONENT_SET` as a direct child. Pages prefixed with `–––` (separator pages like `––– Foundation –––`) and pages named `Cover` are skipped. Nodes named with the `_🚫__` prefix (documentation frames, group labels) are filtered out — they are annotation-only and not imported. Foundation pages (`↳ Color`, `↳ Typography`, etc.) are included if they contain a `COMPONENT_SET`.
   - **`single-page`** — all components live on one library page as sub-frames. Additionally paste the Figma URL of that page. The orchestrator treats each direct sub-frame as one section (legacy model).
   - **`auto`** — the orchestrator inspects the file: if it finds 3+ pages with `COMPONENT_SET` direct children whose names start with `↳ `, it uses `multi-page`; otherwise falls back to `single-page` and asks for the library page URL.
3. **Scope?** Choose one:
   - **Whole file** — process every page in the file
   - **Single page** — only the page the URL points to
   - **Components only** — only `COMPONENT` / `COMPONENT_SET` nodes (skips screens)
   - **Screens only** — only top-level frames (skips library)
4. **Target route prefix for screens?** (e.g. `/` or `/admin/` — every screen frame becomes `{prefix}{kebab-case(frame-name)}`)
5. **Mirror primitives to mobile?** (default: yes for atomic primitives; no for web-only)
6. **Overwrite existing files?** (default: NO — surface conflicts in the plan, let user decide per-file)
7. **Generate domain hooks?** (yes if pages reference data; no if you only want presentational stubs)
8. **Drift mode?** Choose one — **Figma is the single source of truth in this codebase**. The default reflects that.
   - **`sync`** *(default — always pick this unless you have a specific reason not to)* — Figma wins. Token VALUE drift is auto-applied (no per-row confirmation; the regenerated `globals.css` propagates new values to every consumer because components reference tokens by NAME, not by hex). Token RENAMES, REMOVALS, and primitive STRUCTURE changes are surfaced in Section 8 with a full consumer-impact audit and applied on approval — including rewriting every consumer site found.
   - **`additive`** — only ADD new things; never modify or delete existing tokens/primitives. Use this only during early integration when the designer is mid-redesign and you don't want consumer churn yet.
9. **Re-run mode?** Choose one:
   - **`full`** *(default on first run)* — execute Phase B in full (B.1 → B.2 → B.2.5 → B.3 → B.4 → B.5 → B.6 → B.6.5 → B.7).
   - **`preview-only`** — `/design-preview` is broken but the rest of the codebase is fine. Skip B.1, B.3, B.4, B.5, B.6 entirely. Run only A.4.5 (rebuild manifest from Figma) → B.2.5 (regenerate `_library.tsx` and per-section screenshots) → B.7 Gate 0 + Gate 3 + Gate 4. This avoids re-disturbing tokens / primitives / pages just to fix the preview.
   - **`drift-check`** — read-only. Run all of Phase A including A.4.5, output the approval doc, STOP at A.6 even if the user replies `approve`. Useful for "what would change?" without committing.

**Do not proceed until questions 1–5 are answered.** Question 2 defaults to `multi-page` if omitted. If the user replies `single-page`, ask for the library page URL before continuing. If they reply `auto`, proceed to detection in A.2. Question 8 defaults to `sync` in all cases — this template assumes Figma is the single source of truth and any project forked from it wants its Figma values to win over the template's placeholder tokens. Override to `additive` only when explicitly requested. Question 9 defaults to `full` on a fresh codebase and `preview-only` if `apps/webapp/src/app/design-preview/figma-library-manifest.json` already exists AND no other code change is requested.

---

## Phase 0.5 — Pre-flight Discovery (parallel)

### 0.5.0 — Load the Figma MCP tools (deferred — REQUIRED FIRST)

The Figma MCP tools (`mcp__figma__*`, `mcp__figma2__*`) are **deferred** — they appear in the `availableDeferredTools` list but are NOT callable until you load them. Before any other discovery work:

1. Call `tool_search(query="figma mcp design metadata variables screenshot whoami")` to surface the Figma tools.
2. If the search returns **two** namespaces (`mcp_figma` AND `mcp_figma2`), prefer `mcp__figma__*` (the official server). Use `mcp__figma2__*` only as a fallback if a specific call fails.
3. Confirm authentication by calling `mcp__figma__whoami` — should return the user identity (e.g. `dennis@old.st`, Pro tier).
4. **If `tool_search` returns no Figma tools, STOP.** Tell the user the Figma MCP server is not configured in their VS Code settings and link them to the workspace's Figma MCP setup docs. **Do NOT** fall back to a Figma desktop integration, web scraping, or guessing component shapes from the URL slug.

### 0.5.1 — Read-only fan-out (after Figma tools are loaded)

Now run in parallel:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: figma-to-ui-component, figma-to-ui-screen, webapp-ui-primitive, webapp-radix-primitive-wrap, mobile-ui-primitive, webapp-new-page, webapp-api-client-hooks, webapp-form-with-validation, webapp-error-boundaries, webapp-toast-notifications, fe-design-tokens")`
- Read `packages/ui/src/index.ts` and `packages/mobile-ui/src/index.ts` — inventory of existing primitives
- Read `packages/ui/src/lib/tokens.ts` — token inventory
- Read `apps/webapp/src/app/globals.css` — confirm `@source` directives + `@theme` / `.dark` sentinel-bracketed AUTO-GENERATED block (Tailwind v4 hygiene check, Fix B.1). Note: the legacy `.light` mirror block has been REMOVED — light/dark switching is runtime via `<ThemeToggle>` + `next-themes`.
- List `apps/webapp/src/app/(protected)/` — inventory of existing routes

Wait for all to return.

---

## PHASE A — PLAN (read-only)

This phase **MUST NOT WRITE ANY FILES**. Output is a single approval document for the developer.

### A.1 — Parse the Figma URL (fail fast on bad input)

Figma `get_metadata` requires `fileKey` + `nodeId` as **separate params**, NOT the raw URL. Get the conversion right before any tool call.

| URL pattern | `fileKey` | `nodeId` conversion |
|---|---|---|
| `figma.com/design/:fileKey/:name?node-id=:id` | as-is | replace `-` with `:` (e.g. `14-2` → `14:2`) |
| `figma.com/design/:fileKey/branch/:branchKey/:name` | use `branchKey` | same (`-` → `:`) |
| `figma.com/make/:makeFileKey/:name` | use `makeFileKey` | n/a |
| `figma.com/board/:fileKey/:name?node-id=:id` | FigJam — call `mcp__figma__get_figjam` instead of `get_metadata`, pass the original board URL as `figjamUrl` |

If the URL has no `node-id`, omit `nodeId` and traverse from the file root.
If the URL does not match any pattern above, **ask the user to paste it again** — do NOT guess.

**Components-page resolution depends on Q2 (component library structure).**
- **`multi-page` (default):** No separate `componentsNodeId` is needed — component pages are auto-discovered in A.4.5 by walking all pages in the file. Only the file-level `fileKey` is required.
- **`single-page`:** Apply the same URL parsing to the components-page URL from Q2. Record `componentsFileKey` + `componentsNodeId`. Both URLs MUST resolve to the same `fileKey`; if they don't, stop and ask the user which file is canonical.
- **`auto`:** Deferred — A.2 step 6 will determine the structure and set the appropriate values.

### A.2 — Walk the Figma file

With `fileKey` + `nodeId` resolved:

1. `mcp__figma__get_metadata({ fileKey, nodeId })` on the file root (or the requested page)
2. Recursively traverse every page → every top-level frame → every component instance
3. For each unique component, record: name, usage count, has-variants, depends-on-primitives, bound-variables
4. `mcp__figma__get_variable_defs({ fileKey, nodeId })` for token reconciliation — see A.4 for the **mandatory** scoping rule (do NOT call it on a page/canvas node)
5. `mcp__figma__get_screenshot({ fileKey, nodeId })` for any frame > ~600px tall, scoped to logical sub-frames — the screenshot tool clamps output to ~1024×640, so a single shot of a tall page only captures the top portion.
6. **Multi-page detection (Q2 = `auto` only).** After fetching the file metadata in step 1, count pages whose names start with `↳ ` AND have at least one `COMPONENT_SET` as a direct child. If the count is ≥ 3, set Q2 = `multi-page` and log: "Detected multi-page component structure (N component pages found). Using multi-page mode." Otherwise, set Q2 = `single-page` and ask the user for the library page URL before continuing. **Skip this step if Q2 was already answered as `multi-page` or `single-page`.**

### A.3 — Classify every node

For every unique node found, apply the classification rules:

| Signal | Decision | Weight |
|---|---|---|
| Figma type is `COMPONENT_SET` or `COMPONENT` | → Design System (`@old-st/ui`) | High |
| Used in 2+ places across the file | → Design System | High |
| Used in only 1 place AND has clear domain context (name contains "Order", "Project", "Report") | → page-local (`apps/webapp/src/components/{domain}/`) | High |
| Maps to existing `@old-st/ui` primitive (Button, Input, Avatar) | → SKIP (reuse) in `additive` mode; **drift-check** in `sync` mode | High |
| Top-level frame, name suggests a screen ("Dashboard", "Settings") | → Page (`apps/webapp/src/app/(protected)/{route}/page.tsx`) | High |
| Maps to a Radix primitive (a11y-critical: Dialog, Tooltip, Tabs) | → Design System + Radix wrap | High |
| Pure layout frame with no styling intent | → SKIP | Medium |

#### A.3.1 — Primitive drift check (`sync` mode only)

For every primitive that maps to an existing component in `@old-st/ui`, do NOT just mark `SKIP (reuse)`. Pull the Figma component's variant set via `mcp__figma__get_design_context({ fileKey, nodeId })` and compare to the existing component's `cva()` variant keys.

| Comparison result | Action in plan |
|---|---|
| Same variants, same names, same defaults | `SKIP (reuse)` — no drift |
| Figma has variant the code is missing (e.g. new `size: '2xl'`) | `UPDATE — add variant` |
| Code has variant Figma no longer has | `UPDATE — flag for review` (never auto-delete a variant — see Safety Guard #11) |
| Default variant changed in Figma | `UPDATE — change default` |
| Component renamed in Figma | `MANUAL — needs developer decision` (do NOT rename automatically) |

List every drifted primitive in Section 2 of the plan with a `Drift?` column.

### A.4 — Token reconciliation (drift-aware)

**MANDATORY scoping rule — call `get_variable_defs` on a frame or COMPONENT_SET, NEVER on the page/canvas node.**

`mcp__figma__get_variable_defs({ fileKey, nodeId })` returns `"You currently have nothing selected. You need to select a layer first..."` when `nodeId` resolves to a page-level Canvas node (Figma type `CANVAS`). The MCP server falls back to the desktop app's selection state for canvases, which is unreliable from an agent context. To get the full token map, call it on a **frame inside the canvas**.

**Multi-page mode recipe:**
1. For each qualifying component page discovered in A.4.5, call `mcp__figma__get_variable_defs({ fileKey, nodeId: <COMPONENT_SET nodeId> })` to retrieve all variables bound by that component's variants.
2. Merge (union-sum) the results across all pages into the final token table.
3. If the file has a dedicated foundation/tokens page (e.g. `↳ Color`), call `get_variable_defs` on its COMPONENT_SET as well to capture semantic color bindings.

**Single-page mode recipe:**
1. Call `mcp__figma__get_metadata({ fileKey, nodeId: <page nodeId> })` first to discover the wrapper frame's nodeId (it is the first child of the page — often named `Library`, `Components`, or `Design System`).
2. Call `mcp__figma__get_variable_defs({ fileKey, nodeId: <wrapper frame nodeId> })` to retrieve all variables referenced beneath it.
3. If the call still returns the "nothing selected" error, fall back to calling it on individual section frames (e.g. the `Tokens` section, then the `Button` section) and merge the results — every section reference is union-summed into the final token table.

You can also call `get_variable_defs` on a single component (e.g. one swatch rectangle, one button instance) to retrieve **only** the variables that specific component binds — useful for A.3.1 primitive drift checks.

**Light/Dark modes.** The compact response (`{ name: hexValue }`) collapses multi-mode variables to one value. If the file maintains separate Light + Dark mode collections, call `get_variable_defs` once with the file pinned to Light, once pinned to Dark (via Figma's mode selector in the desktop app), and diff the two responses. There is no MCP-level mode argument.

For every Figma Variable referenced anywhere, compare to `packages/ui/src/lib/tokens.ts`:

| Variable | Maps to | Figma value (light) | Code value (light) | Drift? | Action |
|---|---|---|---|---|---|
| `brand-600` | `lightColors.brand[600]` | `#7f56d9` | `#7f56d9` | none | reuse |
| `brand-600` | `lightColors.brand[600]` | `#8b5cf6` | `#7f56d9` | ⚠️ YES | UPDATE tokens.ts (sync) / FLAG (additive) |
| `info-bg` | (none) | `#ecfeff` | n/a | new | propose NEW TOKEN |

Rules:
- Compare BOTH light and dark mode values (collapse to one row if both modes match).
- Sort drifted rows to the top of the table so they're easy to review.
- Aliased semantic variables (e.g. `brand` → `brand-600`) are reported as `→ alias-of` rather than as a hex drift.

**Drift application policy (sync mode — the default).** Not every drift class needs developer approval. Components consume tokens by NAME (`bg-primary`, `bg-brand-600`), so a hex change in `tokens.ts` propagates to every consumer with zero code edits via `pnpm tokens:gen`. Only NAME / STRUCTURE changes touch consumer code.

| Drift class | Auto-apply in `sync`? | Disclosed in | Why |
|---|---|---|---|
| Token VALUE change (same name, new hex) | YES | Section 1 (informational) | Consumers reference tokens by name; regenerated `tokens.css` propagates automatically. Zero consumer edits. |
| New token in Figma | YES | Section 1 | Pure addition; no consumer impact. |
| Primitive VARIANT added in Figma | YES | Section 2 | Pure addition to the `cva()` map. |
| Token RENAMED in Figma (e.g. `Btn` → `Button`) | NO — needs approval | Section 8 with consumer audit | Every consumer site (`bg-Btn`, `tokens.Btn`, `var(--color-btn)`) must be rewritten. B.1.5 does it atomically. |
| Token REMOVED in Figma | NO — needs approval | Section 8 with consumer audit | Same as rename; developer must choose: delete consumers, rebind to another token, or keep as orphan. |
| Primitive VARIANT removed in Figma | NO — needs approval | Section 8 | Consumers may rely on it; offer rebind/delete options. |

**Consumer audit (REQUIRED before any rename / removal row in Section 8).** For every renamed or removed token, grep the workspace for:
- The token name in any `*.tsx` / `*.ts` file (matches both `tokens.{name}` references and Tailwind utility class names like `bg-{name}`, `text-{name}`, `border-{name}`)
- The token name in any `*.css` / `*.scss` file (matches `var(--color-{name-kebab})` lookups)

Record the file count and the first 5 file paths per token. The Section 8 entry MUST include this audit — **never propose a destructive change without listing what it breaks**.

- In `additive` mode ALL of the above are downgraded: even VALUE drift becomes Section 8 ("approve overwrite?"), renames/removals stay Section 8, and Phase B applies nothing without per-row approval.

**Primitive classification (REQUIRED before Section 2 of the plan).** Every existing primitive under `packages/ui/src/components/` MUST be classified as **VISUAL** or **BEHAVIORAL**. The classification determines the default action when Figma and code both have the primitive:

| Signal (any one is sufficient) | Classification |
|---|---|
| Imports from `@radix-ui/*` | **BEHAVIORAL** |
| Imports from `@tanstack/react-table` or other `@tanstack/*` | **BEHAVIORAL** |
| Imports from `react-hook-form` | **BEHAVIORAL** |
| Lives under `packages/ui/src/components/{headless,forms,data}/` (folder convention) | **BEHAVIORAL** |
| None of the above | **VISUAL** |

Detection is a static grep on each primitive's `.tsx` file plus its folder path — do not infer from name. Record the classification per primitive in a working map; the plan doc Section 2 surfaces it.

**Default action matrix (sync mode).** Given the classification, the plan's default action per primitive is:

| Figma side | Code side | Classification | Default action | Surfaced in |
|---|---|---|---|---|
| Has it | Has it, names match | **VISUAL** | **REPLACE** (delete + regen + port tests/stories + rewrite consumers if variants/sizes were renamed) | Section 2 |
| Has it | Has it, names match | **BEHAVIORAL** | **STYLE-ONLY UPDATE** (token-driven restyle; no structural regen — keep the Radix/Tanstack/RHF wiring intact) | Section 2 |
| Has it | Has it, names DIFFER | **VISUAL** | **REPLACE + RENAME** (consumer audit required, rewrite every call site) | Section 8 |
| Has it | Has it, names DIFFER | **BEHAVIORAL** | **PRESERVE + NOTE** (the behavioral primitive's API is part of the engineering surface; do not rename) | Section 2 + Section 8 note |
| Has it | Doesn't have it | n/a | **GENERATE NEW** | Section 2 |
| Doesn't have it | Has it, **0 consumers** | **VISUAL** | **DELETE** (safe — nothing imports it) | Section 8 |
| Doesn't have it | Has it, **>0 consumers** | **VISUAL** | **KEEP** (default — never auto-delete a primitive with live consumers) + offer 4 options | Section 8 |
| Doesn't have it | Has it | **BEHAVIORAL** | **KEEP** (always — Figma can't represent focus traps, sorting, form glue) | Section 2 note |

The "KEEP with consumers" Section 8 entry MUST list 4 options for the developer to choose: **(a) keep as code-only orphan with `// kept after Figma removal on YYYY-MM-DD` comment**, **(b) delete primitive AND every consuming file** (atomic), **(c) rebind consumers to a different existing primitive** (developer supplies the mapping), **(d) abort import and request the designer add the primitive to Figma**. Default selection in the plan = (a) — it's the only non-destructive option.


### A.4.5 — Library frame manifest (REQUIRED — kills the #1 design-preview failure mode)

Before building the approval doc, produce a structured manifest of every component in the library. **The manifest and the per-section screenshots are written to disk at the END of this step — NOT held in chat memory and NOT deferred to Phase B.** Manifest + PNGs are derived snapshots of Figma; they are inputs to the approval doc the developer must review, so writing them now is read-only-equivalent and survives context resets between Phase A and Phase B.

**Branch on Q2 (component library structure):**

---

#### Multi-page mode (Q2 = `multi-page` — the default)

In multi-page mode, each Figma page IS a section. The orchestrator walks all pages in the file and builds the manifest from the `COMPONENT_SET` found on each qualifying page. This matches the structure defined in [docs/figma-design-standards.md](docs/figma-design-standards.md) — one page per component, each page named `↳ ComponentName`, each containing exactly one `COMPONENT_SET` as a direct child.

**Page discovery steps:**

1. `mcp__figma__get_metadata({ fileKey })` on the file root — enumerate all pages (direct children of `figma.root`).
2. **Filter pages.** Include only pages that:
   - Have at least one `COMPONENT_SET` as a direct child, AND
   - Have a name starting with `↳ ` (standard component page prefix per [docs/figma-design-standards.md § 4](docs/figma-design-standards.md))

   Skip these automatically:
   - Separator pages whose names start with `–––` (e.g. `––– Foundation –––`, `––– Core Components –––`)
   - `Cover` page
   - Pages with NO `COMPONENT_SET` direct child (pure reference / annotation pages)

   Foundation pages (`↳ Color`, `↳ Typography`, `↳ Spacing`, `↳ Icons`, `↳ Elevation`) are included if they contain a `COMPONENT_SET`; otherwise skip them (they are token-reference-only and don't produce UI primitives).

3. For each qualifying page, locate the `COMPONENT_SET` direct child and record:
   - `order` — position among qualifying pages (1-indexed, preserving the page order from the file)
   - `nodeId` — the `COMPONENT_SET`'s node ID (NOT the page's node ID) — this is what `_library.tsx` renders and B.2.6 screenshots
   - `pageId` — the page's node ID (e.g. `10:15` for Button)
   - `name` — the page name without the `↳ ` prefix (e.g. `↳ Button` → `Button`, `↳ Input Text` → `Input Text`). Must match the `COMPONENT_SET` name per the design standards.
   - `slug` — `kebab-case(name)` (e.g. `button`, `input-text`, `wizard-stepper`)
   - `childCount` — number of variant children inside the `COMPONENT_SET`, **excluding** any children whose name starts with `_🚫__` (documentation frames, group labels are page-level siblings, not COMPONENT_SET children, but filter defensively)
   - `items[]` — for each variant child of the `COMPONENT_SET`, record `{ name, type, nodeId }`. The variant name follows the `Key=Value, Key=Value` format (e.g. `Size=Small, Variant=Primary, State=Default`). **Filter out** any child whose name starts with `_🚫__`. `items[]` is the list `_library.tsx` MUST render — exact length, exact order, exact names.
   - `source` — `"component-page"` (distinguishes from single-page sections in the manifest schema)
   - `groups[]` — if the page has `_🚫__ label-*` text nodes as direct page children (group labels like "Small", "Medium", "Large"), record them as `{ name, y }` for reference in the design-preview renderer. These labels indicate visual grouping (e.g. rows by Size) but are NOT imported as components — they are annotation-only.
   - `documentation` — if the page has a `_🚫__ documentation` frame as a direct page child, extract its text content for reference in the design-preview section header. This frame contains extraction metadata and is NOT imported.

**Sanity gate (multi-page).** If the discovery in step 2 finds FEWER than 3 qualifying pages, the file may not follow the multi-page standard. STOP and ask:

> Only found N component pages (expected 3+). Pages found: `<list page names>`. Is this the correct file? Reply `proceed anyway` to continue with these pages, or paste a different file URL.

---

#### Single-page mode (Q2 = `single-page`)

In single-page mode, all components live on one library page as sub-frames. This is the legacy model for files that predate the multi-page standard.

**Sanity gate (run BEFORE building the manifest).** Fetch `mcp__figma__get_metadata({ fileKey: componentsFileKey, nodeId: componentsNodeId })` and inspect the direct children's names. If MORE THAN HALF of them match common variant-cell patterns (`Default`, `Hover`, `Pressed`, `Disabled`, `Focus`, `Primary/*`, `Secondary/*`, `Small`, `Medium`, `Large`, or anything that looks like `{name} / {state}`), the user almost certainly pasted a section node by mistake — STOP and reply:

> The node you provided for the components page looks like a single component's variant grid (`<list 3 example child names>`), not a library page. Did you mean the parent page that contains all sections (Tokens, Buttons, Inputs, …)? Paste the corrected URL or reply `proceed anyway`.

Do not continue until the user confirms.

**Single-wrapper-frame auto-descent.** AFTER the variant-cell sanity gate, if `componentsNodeId` resolves to a node with EXACTLY ONE child and that child's name matches `^(Library|Components|Design System|UI Library|Component Library)$` (case-insensitive), automatically descend through the wrapper one level — set `componentsNodeId` to the wrapper's nodeId — and continue.

**Single-page steps:**

1. `mcp__figma__get_metadata({ fileKey: componentsFileKey, nodeId: componentsNodeId })` — record direct children only (the section frames).
2. For each child (in Figma's natural order), record `{ order, nodeId, name, slug, childCount, items[] }`:
   - `order` — 1-indexed position in the parent
   - `nodeId` — exact Figma node ID (e.g. `40:2`)
   - `name` — verbatim Figma name including any `·` middle-dot, leading numbers, etc. (e.g. `01 · Design Tokens`)
   - `slug` — `kebab-case(name)` with leading number preserved (e.g. `01-design-tokens`)
   - `childCount` — total number of direct children (used as the section's expected item count)
   - `items[]` — for each direct child of THAT sub-frame, record `{ name, type, nodeId }`. `nodeId` is the EXACT Figma node ID of the cell — used by B.2.6 to fetch per-primitive screenshots. `items[]` is the list `_library.tsx` MUST render — exact length, exact order, exact names.

---

#### Shared steps (both modes — run AFTER the mode-specific steps above)

The steps below reference "sections" — in multi-page mode, sections are component pages (step 3); in single-page mode, sections are sub-frames within the library page (step 2). Both produce the same manifest shape: `{ order, nodeId, name, slug, childCount, items[] }`.

2a. **Enumerate icons used by the library.** Walk every `INSTANCE` or `VECTOR` node nested inside the section frames (or `COMPONENT_SET` nodes in multi-page mode) that resolves to an icon component (Figma component name matches `*Icon` or lives under a frame literally named `Icons`). Build `icons[]` with one entry per UNIQUE icon symbol: `{ name: '<PascalCase>Icon', figmaNodeId: '<exact node>', svgSource: 'figma' }`. If the Figma file has a dedicated icon page (Phase 0 may surface one), walk that page as well. Deduplicate by `name`.
2b. **Snapshot the pre-existing template icon allowlist.** Read every exported symbol from `packages/ui/src/icons/icons.tsx` (regex: `export function (\w+Icon)\(`). Record them as `templateAllowlist: string[]` in the manifest. These continue to be allowed without a Figma node (they shipped with the template before any import).
3. **Capture per-section screenshots** via `mcp__figma__get_screenshot({ fileKey, nodeId: <section nodeId> })` — one PNG per section. In multi-page mode, `nodeId` is the `COMPONENT_SET` nodeId from step 3; in single-page mode, it's the sub-frame nodeId from step 2. Do NOT take one big screenshot of the whole file (Safety Guard #8 — single-shot is clamped at ~1024×640 and useless for tall pages).
3a. **Capture per-primitive screenshots for every REPLACE / GENERATE-NEW primitive** identified in the classification pass (A.3). For each, call `mcp__figma__get_screenshot({ fileKey, nodeId: <primitive variant-grid node> })` and save to `apps/webapp/src/app/design-preview/figma-references/{primitive-name}.png` (e.g. `button.png`, `list-row.png`). These are the visual ground truth for B.2.6's per-primitive checkpoint and for the thumbnail column in A.5 Section 2. Skip primitives marked KEEP or STYLE-ONLY UPDATE.
4. **WRITE TO DISK NOW** (not in Phase B):
   - `apps/webapp/src/app/design-preview/figma-library-manifest.json` — pretty-printed JSON with these top-level keys: `sections[]` (the section list from multi-page step 3 or single-page step 2), `icons[]` (step 2a), `templateAllowlist[]` (step 2b), and `iconsTraceabilityEnforced: true`. In multi-page mode, each section also includes `pageId`, `source`, `groups[]`, and `documentation`. Sole source of truth from this point on.
   - `apps/webapp/src/app/design-preview/figma-references/{slug}.png` — one PNG per section (step 3).
   - `apps/webapp/src/app/design-preview/figma-references/{primitive-name}.png` — one PNG per REPLACE / GENERATE-NEW primitive (step 3a).
   Yes, this writes files during Phase A. That is intentional — the manifest is a derived snapshot of Figma the developer must review, and persisting it now means a context reset between Phase A and Phase B does not lose the contract. Phase B no longer "builds" the manifest; it consumes it.
5. Re-read the manifest from disk into `figmaLibraryManifest` for use in A.5. From this point on, `_library.tsx` and all parity gates read from the JSON file — never from chat memory.

This manifest IS the design-preview spec. Phase B B.2.5 reads from it; per-section count gates assert against it; B.2.6 reads `figma-references/{primitive-name}.png` for the per-primitive visual checkpoint; the icon traceability lint check reads `icons[]` + `templateAllowlist[]` + `iconsTraceabilityEnforced`.

### A.5 — Produce the approval document

Output a single Markdown document to chat with these sections:

```markdown
# Figma Import Plan

## 1. Tokens (drifted rows first)
| Figma variable | Maps to / NEW | Figma value | Code value | Drift? | Action |
| ... | ... | ... | ... | ... | ... |

## 1.5 — /design-preview library manifest (THIS IS YOUR LAST CHANCE TO CATCH FIGMA-PARSING ERRORS)
Source: `{fileKey}` — {Q2 mode} — {figmaLibraryManifest.length} sections

**Multi-page mode** — each row is a component page in the file:

| # | Page | Component (COMPONENT_SET) | Slug | Variants | Groups | First 3 variants |
|---|---|---|---|---|---|---|
| 1 | `↳ Button` (10:15) | `Button` (10:16) | `button` | 36 | Small, Medium, Large | Size=Small, Variant=Primary, State=Default; … |
| 2 | `↳ Badge` (10:14) | `Badge` (10:17) | `badge` | 45 | Small, Medium, Large | Size=Small, Variant=Primary, State=Default; … |
| …

**Single-page mode** — each row is a sub-frame within the library page:

| # | Figma node | Figma name (verbatim) | Slug | Item count | First 3 items | Renders as |
|---|---|---|---|---|---|---|
| 1 | 40:2 | `01 · Design Tokens` | `01-design-tokens` | 14 | brand, brand-hover, brand-subtle | `<Section01DesignTokens />` (14 swatches) |
| 2 | 41:2 | `02 · Button` | `02-button` | 12 | Primary/Default, Primary/Hover, Primary/Pressed | `<Section02Button />` (12 cells) |
| …

Use the appropriate table format based on the Q2 mode.

**STOP and verify:** Are these the sections you expect? Are the names correct? Are the variant counts right? If anything is off, reply with the correction BEFORE approving — once Phase B starts, the manifest is locked.

## 2. Design System Primitives (packages/ui/src/components/)
| Name | Source node | Figma ref PNG | Classification | Action | Variants | Drift? | Radix wrap? | Mobile mirror? |
| Button | 1:23 | [button.png](apps/webapp/src/app/design-preview/figma-references/button.png) | VISUAL | REPLACE | variant×size | +size:2xl, variant rename default→primary | no | yes |
| Dialog | 1:45 | [dialog.png](apps/webapp/src/app/design-preview/figma-references/dialog.png) | BEHAVIORAL | STYLE-ONLY UPDATE | default | token-only (overlay color) | yes (@radix-ui/react-dialog) | no |
| DataTable | (no Figma node) | — | BEHAVIORAL | KEEP (note) | n/a | n/a | yes (@tanstack/react-table) | no |
| Stepper | (no Figma node) | — | VISUAL | KEEP — 3 live consumers (see Section 8) | n/a | n/a | no | no |
| ...

_Figma ref PNG column links to the per-primitive screenshot captured in A.4.5 step 3a. Click each link in your editor / preview pane before approving — this is the source frame B.2 will regenerate against and B.2.6 will visually verify against. Missing thumbnail = primitive is KEEP or STYLE-ONLY UPDATE and won't be regenerated._

_Action legend: REPLACE = delete file + regenerate from Figma + port `.spec.tsx` / `.stories.tsx` + rewrite consumer call sites if variants/sizes renamed. STYLE-ONLY UPDATE = restyle via token pipeline; structural code untouched. KEEP = no change; Section 8 covers the rationale for items with no Figma equivalent._

## 3. Page-Local Components (apps/webapp/src/components/{domain}/)
| Name | Source node | Domain | Action |
| OrderItemCard | 4:55 | orders | CREATE |
| ...

## 4. Pages (apps/webapp/src/app/(protected)/)
| Route | Source frame | Domains used | Hooks needed | Forms? |
| /dashboard | 14:3 | users, orders | useUsers, useOrders | no |
| ...

## 5. Hooks to add to client-common
| Hook | Domain | Endpoint |
| useTimeEntries | timeTracking | GET /v1/time-entries |
| ...

## 6. Sidebar entries
| Label | Route | Icon |
| Dashboard | /dashboard | LayoutDashboard |

## 7. File-level summary
- Total files to CREATE: N
- Total files to UPDATE: N
- Total files to SKIP (already exists, no overwrite): N
- Estimated time: X min

## 8. Conflicts / decisions needed
_(In `sync` mode, VALUE drift and pure additions do NOT appear here — they auto-apply and are disclosed in Sections 1 / 2. Only destructive / structural / ambiguous changes need approval.)_
- packages/ui/src/components/form-controls/button/button.tsx already exists. Overwrite or skip?
- Frame "Untitled — Copy" has no clear name. Skip or rename?
- **Renamed in Figma:** token `Btn` → `Button`. Consumer audit: 12 files reference `Btn` (e.g. `apps/webapp/src/app/login/page.tsx`, `packages/ui/src/components/form-controls/btn/btn.tsx`, …). On approval B.1.5 renames the key in `tokens.ts` AND rewrites all 12 consumers in the same commit.
- **Removed in Figma:** token `legacy-accent`. Consumer audit: 3 files reference it (e.g. `apps/webapp/src/components/legacy/banner.tsx`, …). On approval, choose: (a) delete consumers, (b) rebind to `accent`, or (c) keep as code-only orphan with a `// kept after Figma removal` comment.
- **Removed in Figma:** primitive variant `Button.size: 'xs'`. Consumer audit: 4 files use it. Choose: (a) delete consumers, (b) rebind to `'sm'`, or (c) keep variant.
- **Drift (additive mode):** 3 tokens drifted, 1 primitive variant added in Figma. Re-run with `sync` mode to apply automatically — current mode requires per-row approval here.
- **VISUAL primitive renamed in Figma:** `Btn` (code) → `Button` (Figma). Consumer audit: 18 files import `Btn` (e.g. `apps/webapp/src/app/(protected)/users/page.tsx`, `apps/webapp/src/components/orders/order-row.tsx`, …). On approval B.2 deletes `btn/` folder, generates fresh `button/` folder from Figma, ports the spec + stories, and rewrites all 18 consumers in the same commit.
- **VISUAL primitive in code, no Figma equivalent:** `Stepper`. Consumer audit: 3 files use it (`apps/webapp/src/app/(protected)/onboarding/page.tsx`, `apps/webapp/src/app/(protected)/settings/wizard/page.tsx`, `apps/webapp/src/components/onboarding/onboarding-flow.tsx`). Choose one: (a) **KEEP as code-only orphan** *(default)* with `// kept after Figma removal on 2026-05-22` comment in `stepper.tsx`; (b) **DELETE primitive AND the 3 consuming files** atomically; (c) **REBIND** consumers to `<Tabs>` or another primitive you supply; (d) **ABORT** import and ask the designer to add `Stepper` to Figma first.
- **BEHAVIORAL primitive in code, no Figma equivalent:** `DataTable` (wraps `@tanstack/react-table`). Auto-classified as BEHAVIORAL; no action needed — Figma cannot represent table sorting/selection logic, so this primitive stays as engineering infrastructure. Listed here for transparency only.
```

### A.5.1 — Aggregate the inspection reports

Phase 0.5 + A.2 + A.3 + A.4 + A.4.5 produced multiple Markdown reports (skill digest, primitive inventory, token diff, drift check, classification table). Pass them all to `result-aggregator` in a single `Agent` call so the developer sees one unified plan instead of N separate dumps:

- `Agent(subagent_type="result-aggregator", prompt="workflow=/figma-import, mode=discovery, inputs=<concatenated Phase 0.5 + A.* reports separated by <!-- agent: {name} --> markers>")`

Use the aggregator's report as the spine of the A.5 approval document. Append the A.5 sections (token table, primitive table, page table, consumer-audit) underneath. Do **not** skip the per-section detail — the aggregator is the summary banner, not a replacement for the full plan.

### A.6 — STOP and request approval

Send the document. End with this exact prompt:

> **APPROVAL REQUIRED.** Reply `approve` to execute the full plan, `approve except: <list>` to skip specific items, or `cancel` to abort. You can also reply with edits (e.g. "rename OrderItemCard to TimeEntryCard") and I will revise the plan.

**DO NOT PROCEED to Phase B without an explicit `approve` reply.**

---

## PHASE B — EXECUTE (only after approval)

### B.0 — Phase B routing (REQUIRED — respects Q9 re-run mode)

Before executing anything below, look up Q9 (re-run mode) from Phase 0 and pick the corresponding execution path:

| Q9 mode | Sections to execute | Sections to SKIP |
|---|---|---|
| `full` (default first run) | B.1 → B.2 → B.2.5 → B.3 → B.4 → B.5 → B.6 → B.6.5 → B.7 (all gates) | none |
| `preview-only` | B.2.5 → B.7 Gate 0 → B.7 Gate 3 → B.7 Gate 4 only | B.1, B.2, B.3, B.4, B.5, B.6, B.6.5, B.7 Gates 1/2/5 |
| `drift-check` | nothing — Phase A already produced the diff doc; STOP here | all of Phase B |

**State the chosen path in chat before running any tool**, e.g. _"Q9 = preview-only — executing B.2.5, B.7 Gate 0, B.7 Gate 3, B.7 Gate 4 only."_ This makes wrong-path execution obvious to the developer.

Execute in this strict order so dependencies resolve:

### B.1 — Tokens (Tailwind v4 + dark mode hardening + drift sync)

**Load skill:** `.claude/skills/fe-design-tokens/SKILL.md`

Even if no new tokens are needed, this phase MUST verify the workspace's Tailwind v4 hygiene rules — they are the #1 cause of "compiles green, renders 0×0" bugs in this codebase.

0. **VALUE drift sync (`sync` mode — auto-applied, no per-row prompt).** For every VALUE drift row from A.4 Section 1, REWRITE the affected entry in `lightColors` / `darkColors` in `packages/ui/src/lib/tokens.ts` to match the Figma variable's value. The change was disclosed in Phase A and the developer already approved the plan as a whole. Only the VALUE changes here — keys stay identical (`brand600` → `brand600`, `primary` → `primary`). The regenerated `tokens.css` (step 2 below) propagates new values to every component via Tailwind utilities (`bg-primary`, `text-brand-600`) — **no consumer code is edited** for value drift. RENAMES and REMOVALS approved in Section 8 are handled by B.1.5 below — not here.

1. **Tokens themselves.** Add new tokens to `packages/ui/src/lib/tokens.ts` (single source of truth) — add to BOTH `lightColors` AND `darkColors`. Mobile picks them up automatically via the re-export in `packages/mobile-ui/src/lib/theme.ts`.
2. **Regenerate `globals.css`.** Run `pnpm tokens:gen`. This rewrites the `@theme { … }` and `.dark { … }` blocks between the AUTO-GENERATED sentinels in `apps/webapp/src/app/globals.css`. **Never hand-edit those blocks.** CI runs `pnpm tokens:check` and fails on drift. The legacy `.light { … }` mirror block has been REMOVED — light/dark switching is runtime via `<ThemeToggle>` and `next-themes`, not via wrapping subtrees in a `.light` className.
3. **`@source` directives — REQUIRED for any cva() consumer outside the project root.**
   Tailwind v4 only auto-scans `apps/webapp/src/`. Workspace packages (`@old-st/ui`, etc.) are excluded by default, so utility classes used inside `cva()` strings (`h-4`, `w-7`, `border-[3px]`) are silently dropped from the generated CSS — components have the class names in markup but no rules backing them, rendering as 0×0 boxes.
   Confirm `globals.css` contains:
   ```css
   @source "../../../../packages/ui/src";
   ```
   (path is relative to `globals.css`). If you add primitives that import from another workspace package, add an `@source` line for that package too.
4. Run `pnpm nx run-many -t build --projects=ui,mobile-ui,webapp --skip-nx-cache` to confirm.

**Do not skip steps 2–3** even on a token-only import — the rules apply to every primitive that may be touched downstream.

### B.1.5 — Token rename / removal consumer rewrite (only when Section 8 has approved rename/removal rows)

Runs AFTER B.1 (value drift applied) and BEFORE B.2 (primitives) so any primitive generated next references the final token names.

For every RENAMED or REMOVED token row approved in Section 8:

1. **Rename** (`{oldName}` → `{newName}`):
   - Update the key in `packages/ui/src/lib/tokens.ts` (both `lightColors` and `darkColors`)
   - For every consumer file in the A.4 audit:
     - `*.tsx` / `*.ts`: replace Tailwind utility class names (`bg-{oldName}` → `bg-{newName}`, `text-{oldName}`, `border-{oldName}`, `ring-{oldName}`, etc.), object lookups (`tokens.{oldName}`, `lightColors.{oldName}`, `darkColors.{oldName}`)
     - `*.css` / `*.scss`: replace `var(--color-{old-kebab})` → `var(--color-{new-kebab})`
2. **Removal** — apply the option the developer chose in Section 8:
   - **(a) Delete consumers:** remove the consuming lines/elements. Surface the diff for review.
   - **(b) Rebind to `{otherToken}`:** same mechanics as rename, pointing every consumer at `{otherToken}` instead.
   - **(c) Keep as orphan:** leave the `tokens.ts` entry, prepend a `// kept after Figma removal on {YYYY-MM-DD}` comment, do not touch consumers.
3. **Always regenerate after key changes:** `pnpm tokens:gen` — keys map to CSS variable names, so a rename also changes `--color-{kebab}`.
4. **Verify:** `pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui,client-common,webapp`. Build failures here almost always mean a consumer site was missed in the audit — grep harder and re-run.

DO NOT proceed to B.2 if B.1.5 build fails. A broken token reference at this point cascades through every primitive generated downstream.

### B.2 — Design System primitives

**Load skill:** `.claude/skills/figma-to-ui-component/SKILL.md`
**Load skill:** `.claude/skills/webapp-ui-primitive/SKILL.md`
**Load skill:** `.claude/skills/webapp-radix-primitive-wrap/SKILL.md` (only for Radix-marked rows)
**Load skill:** `.claude/skills/fe-icon-set/SKILL.md` (if any new icons appear in the Figma frame)

Folder layout: primitives live in **per-component subfolders inside category folders** with a non-negotiable four-file contract:
`packages/ui/src/components/{form-controls|data-display|feedback|navigation|layout}/{name}/{name}.tsx` + `index.ts` + `{name}.stories.tsx` + `{name}.spec.tsx`. Internal imports of `cn` use `'../../../lib/utils'` (3 levels up). Cross-category sibling imports use the relative category path. **No `.scss` / `.sass` / per-component CSS Module files — explicitly rejected (see `webapp-ui-primitive` skill § Forbidden).**

For each primitive in the plan (in dependency order — leaf primitives first):

**Branch on the Action column from Section 2 of the approved plan:**

- **Action = REPLACE (VISUAL primitive, Figma is source of truth):**
  1. Read the existing `{name}.tsx`, `{name}.spec.tsx`, `{name}.stories.tsx` into memory — you will port assertions and story arg shapes, not text.
  2. Delete the old `packages/ui/src/components/{category}/{name}/` folder.
  3. Generate the new primitive fresh from Figma (cva variants/sizes match Figma exactly).
  4. Port `.spec.tsx` — keep behavioral assertions ("calls onClick", "renders children", "forwards ref"); update variant/size names to the new Figma names; drop snapshot tests (they will be regenerated on first run).
  5. Port `.stories.tsx` — one story per Figma variant×size combination; preserve any non-trivial Story args from the old file (decorators, fixture data).
  6. If variants/sizes were renamed in the plan, rewrite every consumer site listed in the audit in the same edit batch (e.g. `<Button variant="default">` → `<Button variant="primary">`).
  7. Re-export from `packages/ui/src/index.ts` under the matching `// {category}` comment block (preserve if the export already exists).
  8. If "Mobile mirror?" = yes, regenerate `packages/mobile-ui/src/components/{name}.tsx` with the same variant API.

- **Action = STYLE-ONLY UPDATE (BEHAVIORAL primitive, Figma owns colors not structure):**
  1. Do NOT delete or regenerate the `.tsx` file — the Radix/Tanstack/RHF wiring is engineering surface, not design surface.
  2. Update Tailwind class strings inside the existing component to use any newly-introduced tokens (e.g. `data-[state=open]:bg-popover` becomes `data-[state=open]:bg-overlay` if Figma renamed the token).
  3. Update `.stories.tsx` if visual variants changed (e.g. new size).
  4. Do NOT touch `.spec.tsx` unless a variant name actually changed.
  5. Do NOT rename the primitive itself even if Figma uses a different name — the BEHAVIORAL primitive's API is the contract, and consumers import it by name.

- **Action = GENERATE NEW (Figma has it, code doesn't):**
  1. Generate / update `packages/ui/src/components/{category}/{name}/{name}.tsx` + `index.ts`
  2. Generate `packages/ui/src/components/{category}/{name}/{name}.stories.tsx` (canonical visual reference)
  3. Generate `packages/ui/src/components/{category}/{name}/{name}.spec.tsx` (Jest + RTL, 70% coverage target)
  4. Re-export from `packages/ui/src/index.ts` under the matching `// {category}` comment block
  5. If "Mobile mirror?" = yes, also generate `packages/mobile-ui/src/components/{name}.tsx` (mobile does not ship Storybook — verify in Expo dev client)
  6. If the design references icons not yet in `packages/ui/src/icons/icons.tsx`, add them via the `fe-icon-set` skill BEFORE generating the consuming primitive.

- **Action = KEEP — orphan / behavioral (Section 8 approved):** no file changes. Add the dated `// kept after Figma removal on YYYY-MM-DD` comment for VISUAL orphans only; BEHAVIORAL keeps need no comment.

- **Action = KEEP — DELETE + consumers (Section 8 option b):** delete the primitive folder AND every file listed in the consumer audit in the same edit batch. Build will fail if any consumer is missed — that's the safety net.

- **Action = KEEP — REBIND (Section 8 option c):** delete the primitive folder; rewrite every consumer site to use the developer-supplied replacement primitive (e.g. `<Stepper>` → `<Tabs>` with adapted props).

After this section: `pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui` plus `pnpm nx run ui:build-storybook`. Fix errors before proceeding.

### B.2.4 — Type checkpoint (MANDATORY between B.2 and B.2.5)

Before generating `_library.tsx` from the manifest, run an isolated type/build gate against the primitive packages:

```powershell
pnpm nx run-many -t build --projects=ui,mobile-ui
```

This is a strict subset of Gate 2 — it deliberately runs BEFORE `_library.tsx` is regenerated so that any prop-shape or rename drift introduced in B.2 surfaces as a primitive-layer error, not a `_library.tsx` consumer error. RED here almost always means:

- A primitive REPLACE renamed a prop (e.g. `EmptyState.action` → `EmptyState.cta`) without updating the matching `index.ts` barrel re-export or the mobile mirror.
- A variant rename was applied in `cva()` but the `VariantProps<typeof xVariants>` consumer in the same file references the old key.
- A new primitive was generated but not added to `packages/ui/src/index.ts`.

Fix the primitive surface here. Do NOT silence the error in `_library.tsx` — the manifest-driven generator in B.2.5 reads the manifest, not the primitive TypeScript surface, and will compound the bug.

### B.2.5 — Design Preview (deterministic, manifest-driven)

**This used to be B.6.5 and ran last. It now runs immediately after primitives because (a) the agent's context is freshest here and (b) verifying the library here catches primitive bugs before pages consume them.**

The library manifest written to disk in A.4.5 is the spec. The algorithm below MUST be followed mechanically — there is no interpretation step. **At this point `figma-library-manifest.json` and `figma-references/{slug}.png` already exist on disk** (they were written in A.4.5). Do NOT re-fetch from Figma here unless the JSON is missing — if it is, the workflow was started mid-flight; STOP and tell the developer to run Phase A first.

**Step 1 — `_library.tsx` MUST be data-driven, not hand-written JSX.** The agent does NOT count cells, does NOT type out one component per item, does NOT write `// SECTION CHECK:` comments. Instead, generate a single file shaped like this:

```tsx
import manifest from './figma-library-manifest.json';
import { PreviewSection, PreviewCell } from './_shell';
// + the renderers per section type (TokenSwatch, ButtonVariantGrid, ...)

// One renderer per section "shape". The agent picks the right renderer for
// each section based on the Figma node's content (swatch grid vs variant
// grid vs single-component showcase). Renderers map manifest.items[] →
// <PreviewCell> children — they CANNOT short-circuit, slice, or pad.
const RENDERERS: Record<string, React.FC<{ items: ManifestItem[] }>> = {
  '01-design-tokens': TokenSwatchSection,
  '02-button': ButtonVariantSection,
  // ...
};

export function FullLibrary() {
  return (
    <>
      {manifest.map((section) => {
        const Renderer = RENDERERS[section.slug];
        if (!Renderer) {
          throw new Error(
            `No renderer registered for section ${section.slug}. ` +
            `Add an entry to RENDERERS in _library.tsx.`
          );
        }
        return (
          <PreviewSection
            key={section.slug}
            id={section.slug}
            title={section.name}
            figmaNode={section.nodeId}
            data-section-id={section.slug}
            data-section-expected-count={section.items.length}
          >
            <Renderer items={section.items} />
          </PreviewSection>
        );
      })}
    </>
  );
}
```

**Mandatory contract for every renderer:**

```tsx
function TokenSwatchSection({ items }: { items: ManifestItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        // data-section-item is REQUIRED on the outermost element of every cell
        // — Gate 0 counts these to assert parity with the manifest.
        <div key={item.name} data-section-item>
          <TokenSwatch name={item.name} />
        </div>
      ))}
    </div>
  );
}
```

Rules the agent MUST follow:

- `_library.tsx` reads from `./figma-library-manifest.json`. It NEVER hardcodes section names, slugs, item counts, or item names.
- Every cell's outermost element has `data-section-item` (no value needed). Gate 0 counts these.
- `<PreviewSection>` always receives `data-section-id={section.slug}` and `data-section-expected-count={section.items.length}` so Gate 0 can locate sections and read the expected count from the DOM.
- If a renderer needs to handle items the agent doesn't recognize, it renders an `<UnmappedItem name={item.name} />` placeholder — NOT a silent skip. Skipping is what causes the off-by-one failures.
- Renderers receive ONLY `items` — no extra props, no manifest-wide context. This guarantees `items.length` cells always render.

**Step 2 — Anti-hallucination card.** Before writing renderers, run through this table. If you catch yourself doing the left column, STOP and do the right.

| Temptation | Required behavior |
|---|---|
| "Round out the row to look balanced (e.g. add a 4th button row)" | Render exactly `items.length` cells via `.map()` |
| "Add `sm` / `md` / `lg` size variants since `<Button>` supports them" | Render only the variants in `items[]` |
| "Add 'background', 'foreground', 'card' to make Tokens look complete" | Render only the named tokens in `items[]` |
| "Group sections 02–10 into one '/components' page for tidiness" | One `<PreviewSection>` per manifest entry, in manifest order |
| "Use semantic names like 'Primary action'" | Use `item.name` verbatim |
| "Use `` className={`bg-${prefix}-${step}`} `` for a 5×11 color scale" | Tailwind v4 JIT does NOT see template-literal classes (Golden Rule #23o). Use `style={{ backgroundColor: lightColors[key] }}` instead. The lint check `no-dynamic-tailwind-classes` will fail otherwise. |

**Step 3 — Optional sub-page deep links.** ONLY if useful. Each is a thin wrapper (no inline content):

```tsx
import { PreviewShell } from '../_shell';
import { FullLibrary } from '../_library';
import manifest from '../figma-library-manifest.json';

export default function NameSubPage() {
  const section = manifest.find((s) => s.slug === '02-button')!;
  return (
    <PreviewShell title={section.name}>
      {/* Render JUST this section by reusing FullLibrary's renderer table */}
      <SectionRenderer slug={section.slug} items={section.items} />
    </PreviewShell>
  );
}
```

Sub-page slugs MUST come from `manifest[i].slug`. Never invent a `/components` mega-page that bundles multiple sections.

**Step 4 — One-time scaffold (idempotent).** On first run only, also create:
- `apps/webapp/src/app/design-preview/_shell.tsx` (PreviewShell + PreviewSection + PreviewCell helpers + ThemeToggle). `<PreviewSection>` MUST forward `data-section-id` and `data-section-expected-count` to its outermost DOM element so Gate 0 can read them.
- `apps/webapp/src/app/design-preview/page.tsx` (renders `<FullLibrary />`, gated on `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW` for production)
- Append `{ path: '/design-preview', name: 'design-preview' }` to `PAGES_TO_SCAN` in [apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts](apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts#L15)
- Create `apps/webapp-e2e/src/specs/visual/library-parity.spec.ts` — runtime parity test (see Step 5)
- Create `apps/webapp-e2e/src/specs/visual/design-preview.spec.ts` — Playwright `toHaveScreenshot()` test, **but do NOT generate the baseline here**. The baseline is created in Gate 4 AFTER Gate 3 confirms the page renders correctly.
- Add `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=` (empty default) to `.env.local.example`
- Add the `Verify /design-preview reachable` step to `.github/workflows/cd-deploy.yml`

**Step 5 — Library parity spec (REQUIRED — replaces the old "agent counts JSX" gate).** Generate `apps/webapp-e2e/src/specs/visual/library-parity.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import manifest from '../../../../apps/webapp/src/app/design-preview/figma-library-manifest.json';

test('design-preview matches Figma library manifest exactly', async ({ page }) => {
  await page.goto('/design-preview');

  // 1. Same number of sections as manifest, in the same order.
  const sectionIds = await page.locator('[data-section-id]').evaluateAll(
    (nodes) => nodes.map((n) => n.getAttribute('data-section-id'))
  );
  expect(sectionIds).toEqual(manifest.map((s) => s.slug));

  // 2. Each section's cell count equals manifest[i].items.length.
  for (const section of manifest) {
    const cellCount = await page
      .locator(`[data-section-id="${section.slug}"] [data-section-item]`)
      .count();
    expect(
      cellCount,
      `Section "${section.name}" (${section.slug}): expected ${section.items.length} cells, got ${cellCount}`
    ).toBe(section.items.length);
  }
});
```

This is Gate 0. It is a real assertion against the live DOM, not an agent counting JSX.

**Step 6 — Theme + import discipline.**
- Use `<ThemeToggle>` from `@old-st/ui` for dark mode. Never wrap subtrees in `.light` / `.dark` divs.
- `_library.tsx` may import only: `react`, `next/link`, `@old-st/ui`, `@old-st/ui/lib/tokens`, the local `_shell.tsx`, and `./figma-library-manifest.json`. No domain components, no API calls.

### B.2.6 — Per-primitive visual checkpoint (MANDATORY — kills the visual-drift back-and-forth)

The composed `/design-preview` page is now rendered, but a primitive can pass Gate 0 (correct cell count), Gate 2 (TypeScript green), and still be visually wrong (token mismatch, wrong padding, wrong corner radius, missing or hallucinated icon, drifted hover state). Catching that here — before B.3 (hooks), B.4 (components), and B.5 (pages) consume the primitives — turns a multi-round back-and-forth into a single bulk review.

Boot Storybook in the background:

```powershell
pnpm nx run ui:storybook
```

(Sandbox is on http://localhost:4400; this step assumes Phase B has not killed the existing dev terminals.)

Then produce a checklist in chat with one row per REPLACE / GENERATE-NEW primitive from the approved Section 2 — KEEP and STYLE-ONLY UPDATE rows are excluded. Each row pairs the Storybook docs URL with the per-primitive Figma reference PNG captured in A.4.5 step 3a:

```markdown
## Per-primitive visual checkpoint

Open each Storybook page and compare it side-by-side with the Figma reference PNG. Then reply with ONE of:
- `all ok` — every primitive matches; proceed to B.3.
- `regenerate <name> [<name> ...]` — list primitives that need a re-run of B.2 for that specific component; I will regenerate them and re-show this checklist.
- `n: <free-form notes per primitive>` — anything else (token tweaks, story arg fixes); I will apply them and re-show this checklist.

| # | Primitive | Storybook | Figma ref PNG | Action in B.2 |
|---|---|---|---|---|
| 1 | button | http://localhost:4400/?path=/docs/form-controls-button--docs | [button.png](apps/webapp/src/app/design-preview/figma-references/button.png) | REPLACE |
| 2 | list-row | http://localhost:4400/?path=/docs/data-display-list-row--docs | [list-row.png](apps/webapp/src/app/design-preview/figma-references/list-row.png) | GENERATE NEW |
| 3 | empty-state | http://localhost:4400/?path=/docs/data-display-empty-state--docs | [empty-state.png](apps/webapp/src/app/design-preview/figma-references/empty-state.png) | GENERATE NEW |
| ... |
```

Loop on the developer's reply until they answer `all ok`. Each regenerate request runs the relevant B.2 branch ONLY for the named primitive (not the whole batch) — the manifest and the rest of the library stay locked.

**Things to check side-by-side per primitive (this is the same heuristic the developer would apply manually):**

- All variants from Figma are present and visually match (not just the default).
- Padding, corner radius, border weight, shadow elevation match Figma.
- Color values come from tokens — no inline hex, no `lucide-react`-style color drift.
- Icons inside the primitive are the SAME icons as Figma. If the primitive uses an icon not listed in `manifest.icons[]`, regenerate — the agent invented it (Safety Guard #17).
- Storybook Controls panel (right sidebar) flips every cva variant and the rendered preview updates. If a control does nothing, the story violates the Stories contract from `webapp-ui-primitive` skill — fix the `args:` / `argTypes:` rather than the className.
- Dark mode toggle in the Storybook toolbar works.

The existing Gate 3 in B.7 stays as a regression check against the composed `/design-preview` page (catches issues that emerge only when primitives sit next to each other). B.2.6 is the per-primitive line of defence.

### B.3 — Hooks (if any)

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

Add hooks to `packages/client-common/src/hooks/use-{domain}.ts` and re-export.

Verify: `pnpm nx build client-common`.

### B.4 — Page-local domain components

For each page-local component:

1. Generate `apps/webapp/src/components/{domain}/{name}.tsx`
2. Compose using `@old-st/ui` primitives only
3. Use the cn() helper for className merging

### B.5 — Pages

**Load skill:** `.claude/skills/figma-to-ui-screen/SKILL.md`
**Load skill:** `.claude/skills/webapp-new-page/SKILL.md`
**Load skill:** `.claude/skills/webapp-error-boundaries/SKILL.md`
**Load skill:** `.claude/skills/webapp-skeleton-loading/SKILL.md`
**Load skill:** `.claude/skills/webapp-toast-notifications/SKILL.md` (if any mutations)
**Load skill:** `.claude/skills/webapp-form-with-validation/SKILL.md` (if any forms)

For each page:

1. Generate `apps/webapp/src/app/(protected)/{route}/page.tsx` as a thin orchestrator
2. Generate `apps/webapp/src/app/(protected)/{route}/loading.tsx`
3. Generate `apps/webapp/src/app/(protected)/{route}/error.tsx`
4. Wire hooks, forms, toasts as planned

### B.6 — Sidebar wiring

Update `apps/webapp/src/components/layout/sidebar.tsx` with all new entries from the plan.

### B.6.5 — Design Preview re-verify

The `/design-preview` surface was generated in **B.2.5** (right after primitives), driven by the manifest at `apps/webapp/src/app/design-preview/figma-library-manifest.json`. By the time we reach B.6.5, primitives, hooks, components, and pages may have changed in ways that affect rendering. Re-run **Gate 0** from B.7 (the Playwright parity test). If it fails, the upstream change broke a primitive or a renderer — fix the primitive / renderer, do not paper over it in `_library.tsx`. Do NOT regenerate the manifest from Figma here — the manifest was locked at A.4.5 / approval time.

### B.7 — Final verification

Run the verification gates **in this order** — each one catches a different class of failure. Stop and fix at the first red gate; do not continue.

**Gate 0 — Library manifest parity (kills the #1 design-preview failure mode):**

Run the parity test created in B.2.5 Step 5:

```powershell
pnpm nx e2e webapp-e2e -- --grep "design-preview matches Figma library manifest"
```

This is a real Playwright assertion that loads `/design-preview` and counts `[data-section-item]` per `[data-section-id]` against `figma-library-manifest.json`. **No agent eyeballing JSX.** Failure messages name the offending section and the expected vs actual count. Fix `_library.tsx` (likely a missing renderer or a renderer that filters items) before running any other gate.

**Gate 1 — Token drift (fast, 1s):**

```powershell
pnpm tokens:check
```

Fails if `tokens.ts` was edited without running `pnpm tokens:gen`. Same check CI runs in `ci-fast-check.yml`.

**Gate 2 — Static checks + 70% coverage on `packages/ui` (build safety net for REPLACE actions):**

```powershell
pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui,client-common,webapp
pnpm nx run ui:build-storybook
```

This gate is the safety net for every `REPLACE` action in B.2. If a consumer call site was missed during a variant rename (e.g. `<Button variant="default">` not rewritten to `<Button variant="primary">`), TypeScript fails here — the import workflow refuses to continue. **Do not edit the consuming file to silence the TS error; go back and complete the rewrite that B.2 should have done atomically.** A red Gate 2 after a REPLACE almost always means the Section 8 consumer audit undercounted — grep the symbol again to find what was missed.

**Gate 2.5 — Backfill allowlist must stay empty:**

`scripts/lint-standards.ts` defines `UI_PRIMITIVE_BACKFILL_ALLOWLIST` for the `ui-primitive-has-story-and-spec` check. After this run completes, that Set MUST be empty (`new Set<string>([])`). Phase B is forbidden from adding entries to it — every primitive shipped in B.1 must include its `.stories.tsx` and `.spec.tsx` siblings. Verify with:

```powershell
node -e "const s=require('fs').readFileSync('scripts/lint-standards.ts','utf8');const m=s.match(/UI_PRIMITIVE_BACKFILL_ALLOWLIST = new Set<string>\(\[([\s\S]*?)\]\)/);if(!m||m[1].trim()){console.error('FAIL: allowlist not empty');process.exit(1)}console.log('OK')"
```

If it fails: ship the missing files; do not edit the allowlist.

**Gate 3 — Runtime render (the only gate that catches Tailwind v4 cva drops):**

```powershell
pnpm nx run webapp:dev
```

In another terminal:

```powershell
curl -sS -o $null -w "%{http_code}" http://localhost:4200/design-preview
```

Must return `200`. Then open `/design-preview` and **scroll the full page side-by-side with each PNG in `apps/webapp/src/app/design-preview/figma-references/`** (one per section). A single combined screenshot would be useless — Figma clamps screenshots at ~1024×640, so per-section PNGs are the only reliable visual ground truth.

**Only proceed to Gate 4 once Gate 3 visually confirms the page is correct.** Otherwise the visual-regression baseline locks in the broken state.

**Gate 4 — Automated visual regression:**

First run (no baseline yet) — capture the baseline AFTER Gate 3 has confirmed the page renders correctly:

```powershell
pnpm nx e2e webapp-e2e -- --grep design-preview --update-snapshots
```

Then commit the generated PNG(s) under `apps/webapp-e2e/src/specs/visual/design-preview.spec.ts-snapshots/`. Subsequent runs:

```powershell
pnpm nx e2e webapp-e2e -- --grep design-preview
```

Any drift > 2% fails. If the diff is intentional (a Figma update applied via this workflow), re-run with `--update-snapshots` and commit the new baseline.

**Gate 5 — Accessibility (axe over `/design-preview` + every domain page):**

```powershell
pnpm nx e2e webapp-e2e -- --grep @a11y
```

Fails on `critical` / `serious` axe violations. Color-contrast fixes go into `tokens.ts`, not the consumer.

Symptoms and likely causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| Primitive renders as 0×0 box | Missing `@source` for the package | B.1 step 3 |
| Wrong colors / silent fallback to muted | Token added to `tokens.ts` but `pnpm tokens:gen` not run | B.1 step 2 |
| `pnpm tokens:check` fails on CI | Same as above — commit the regenerated `globals.css` | B.1 step 2 |
| Dark mode shows the same as light | New token added to `lightColors` only — mirror to `darkColors` | B.1 step 1 |
| 404 in production | `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW` not set on the deploy | B.2.5 Step 5 |
| Visual-regression baseline missing | First scaffold did not run `--update-snapshots` | B.2.5 Step 5 |
| Visual diff > 2% on every run | Baseline stale after intentional Figma update — re-run `--update-snapshots` and commit | B.7 Gate 4 |
| Axe `critical` / `serious` failure on a primitive | Color-contrast or aria attribute drift | fix in `tokens.ts` or the primitive, not the page |
| CD `Verify /design-preview reachable` step fails | Env var missing OR primitive crashed at SSR | B.2.5 Step 5 + check Lambda logs |

If the page does not render correctly, the import is **not done** — fix and re-verify before reporting B.8.

### B.8 — Report + commit suggestion

Output a per-section summary:

```
✅ Tokens: 3 added
✅ DS primitives: 8 created, 2 updated, 1 skipped (Button — exists)
✅ Hooks: 2 hooks added
✅ Domain components: 5 created
✅ Pages: 4 created
✅ Sidebar: 4 entries added
✅ Build: green
✅ tokens:check: green
✅ Visual regression: green (or N updated, baseline re-committed)
✅ axe @a11y: green (0 critical, 0 serious)
```

Suggest **grouped commits** so the developer can review in passes:

```
1. feat(tokens): add info-bg, info-text, accent-soft from Figma import
2. feat(ui): import 8 primitives from Figma — Toast, Switch, Tabs, ...
3. feat(client-common): add useTimeEntries, useProjects hooks
4. feat(webapp): import dashboard + reports + projects + settings pages
```

---

## Safety guards (always enforce)

1. **Never overwrite without permission.** Phase A surfaces every conflict; Phase B only overwrites items the user explicitly approved.
2. **Never write `<button>`, `<input>`, `<table>` directly in pages.** Use `@old-st/ui` primitives.
3. **Never inline hex colors.** Always go through tokens / semantic Tailwind utilities.
4. **Never proceed past Phase A without approval.**
5. **If Phase B fails halfway,** report what was created up to the failure, do NOT roll back, let the developer decide whether to continue or revert via git.
6. **If the Figma file is messy** (lots of `Untitled`, `Frame 123`, no components), surface that in Phase A and ask whether to proceed, rename, or skip.
7. **Never trust `nx build` alone for primitive correctness.** Tailwind v4 + cva produce "compiles green, renders blank" failures. The Design Preview page (B.2.5) is the only reliable runtime check.
8. **`mcp__figma__get_screenshot` clamps output to ~1024×640.** For tall pages, request multiple screenshots of named sub-frames or rely on dimension dumps via `mcp__figma__get_metadata`.
9. **Figma MCP tools are deferred.** Always run `tool_search` (Phase 0.5.0) before calling them. If they're missing, do NOT fall back to scraping or to the Figma desktop app — STOP and tell the user.
10. **Component library source drift is the #1 cause of design-preview replicating the wrong frames.**
    - **Multi-page mode:** A.4.5 discovers component pages by walking the file’s page list and filtering for pages named `↳ *` that contain a `COMPONENT_SET` direct child. The orchestrator MUST use the `COMPONENT_SET` on each qualifying page — never substitute a frame from a different page or invent sections that don’t exist as pages. If a page’s `COMPONENT_SET` cannot be found (node was deleted or renamed), STOP and report: "Page `↳ X` has no COMPONENT_SET — was it removed from Figma?".
    - **Single-page mode:** If Phase 0 question 2 provided a library page URL, A.4.5 + B.2.5 MUST use that exact node — never substitute a sibling frame. If the answered node turns out to be invalid (404, wrong file, FigJam board), STOP and re-ask question 2.
    - **Both modes:** Nodes named with the `_🚫__` prefix (documentation frames, group labels) are annotation-only per [docs/figma-design-standards.md § 4](docs/figma-design-standards.md). They MUST be filtered out of `items[]` during manifest building. They inform the design-preview renderer (group headings, doc sections) but are NEVER imported as components or counted as variants.
11. **Drift sync may apply destructive changes ONLY when listed in Section 8 with a consumer audit AND approved in Phase A.** This template treats Figma as the single source of truth, so renames and removals are expected — they must just be auditable.
    - **Auto-applied without per-row approval:** VALUE drift (token hex change), pure additions (new tokens, new variants).
    - **Requires Section 8 + consumer audit + approval:** token RENAME, token REMOVAL, primitive VARIANT removal, folder reorg, category move.
    - **Forbidden under all circumstances:**
      - Silent destructive changes (anything not disclosed in the Phase A approval doc)
      - Renames or removals applied without the matching consumer-site rewrite (would leave the codebase broken)
      - Folder reorgs without an explicit `--restructure` flag (out of scope for this workflow — surface in Section 8 as `MANUAL`)
      - Touching anything outside `packages/ui/src/lib/tokens.ts`, `packages/ui/src/components/{category}/{name}/`, and the consumer files listed in the approved audit
    Old behaviour ("never delete, never rename") was correct when Figma was treated as advisory. It is wrong for this template, where Figma values overwrite template defaults on first import.
12. **`/design-preview` MUST be a 1:1 vertical mirror of the Figma component library — never a hub, never a re-decomposition.** In multi-page mode, each component page becomes one section; in single-page mode, each sub-frame becomes one section. Section count, section order, section names, variant counts, and item counts all come from the Figma file via `mcp__figma__get_metadata` — never invented to "round out" a section. If you find yourself adding entries Figma doesn't have ("background, foreground, card" semantic tokens when Figma only shows 14 named swatches), STOP — that's the canonical hallucination. The only acceptable additions are short labels under swatches that Figma already shows but doesn't textualize.
13. **`figma-library-manifest.json` is the contract — `_library.tsx` is the implementation.** The manifest is built in A.4.5, surfaced in the approval doc Section 1.5, locked at approval time, committed to the repo in B.2.5 Step 0, and asserted by Gate 0 in B.7. If the manifest disagrees with `_library.tsx` at any point, `_library.tsx` is wrong — never edit the manifest to match the code. Re-runs that detect manifest drift from Figma must surface the diff in Phase A and ask before overwriting.
14. **Tailwind v4 JIT does not see template-literal class names (Golden Rule #23o).** This bug class is endemic to color scales (5×11 grids built dynamically). In B.2.5, color-scale sections MUST use inline `style={{ backgroundColor: lightColors[key] }}` driven by the token source-of-truth — never `` className={`bg-${prefix}-${step}`} ``. The `no-dynamic-tailwind-classes` lint check fails the build otherwise.
15. **Primitive classification (VISUAL vs BEHAVIORAL) drives default action; do NOT skip it.** Every primitive in Section 2 MUST have a Classification column. Detection rules are static (Radix/Tanstack/RHF imports OR `{headless,forms,data}/` folder) — do not infer from primitive name. Misclassifying a VISUAL primitive as BEHAVIORAL silently leaves Figma drift in place; misclassifying BEHAVIORAL as VISUAL throws away the Radix/Tanstack/RHF wrapping work and ships an inaccessible regenerated component. When in doubt, mark as BEHAVIORAL — the cost of leaving a visual drift is lower than the cost of destroying a focus-trapped Dialog.
16. **Never auto-delete a primitive that has live consumers, even if Figma removed it.** The default for "code has it, Figma doesn't, >0 consumers" is KEEP-as-orphan. Deletion requires Section 8 option (b) which atomically removes the primitive AND every consuming file in the same commit — picked explicitly by the developer. This is the only rule that prevents `/figma-import` from leaving the codebase in a non-building state.
17. **`_library.tsx` is data-driven, never hand-written.** Sections, slugs, item counts, and item names come from `figma-library-manifest.json` via `.map()` — the agent picks ONE renderer per section shape and that renderer iterates `items[]`. The agent does NOT count cells, does NOT type out one component per item, does NOT write `// SECTION CHECK:` comments. Hand-counting JSX is the original failure mode this workflow exists to eliminate. Gate 0 is a real Playwright assertion against the live DOM.
18. **Manifest + per-section PNGs are written to disk in A.4.5, NOT held in chat memory.** A context reset between Phase A and Phase B is expected and must not destroy the contract. If `figma-library-manifest.json` is missing when B.2.5 runs, the workflow was started mid-flight — STOP and tell the developer to re-run Phase A. Never re-fetch from Figma in Phase B.
19. **No agent-invented icons.** Every new icon added to `packages/ui/src/icons/icons.tsx` during a Figma workflow MUST trace to an entry in `manifest.icons[]` (icon present in the imported Figma file) or to `manifest.templateAllowlist[]` (snapshot of icons that shipped with the template before any Figma import). The agent may NOT pull from `lucide-react` or any other icon library "because it would fit thematically" — the canonical failure mode here was a `ClockIcon` added to an empty-state that did not exist anywhere in Figma. Enforced by the `figma-imported-icons-have-manifest-entry` structural lint check ([scripts/lint-standards.ts](scripts/lint-standards.ts)) and the `fe-icon-set` skill § Provenance during Figma imports.
20. **B.2.6 per-primitive visual checkpoint is mandatory — NEVER skip.** Every REPLACE / GENERATE-NEW primitive from Section 2 of the approved plan MUST appear in the B.2.6 checklist. The agent does not proceed to B.3 (hooks) until the developer replies `all ok`. Pushing the only visual sign-off to Gate 3 (end of Phase B, after pages consume the primitives) was the structural reason that the previous workflow needed 13 back-and-forth correction rounds. B.2.6 catches drift while regenerating ONE primitive is still cheap.
21. **Stories ship working argType panels.** Every cva variant key in a `packages/ui/src/components/**/{name}.tsx` MUST appear in `{name}.stories.tsx` as both an `argTypes` entry AND have at least one named story that sets the value via `args:`. Setting `<Component className="variant-brand">` to demo a variant is forbidden — the Controls addon panel cannot reflect it, the Show Code panel surfaces a className blob instead of an `args:` object, and the agent silently "completes" the stories file with a non-functional addon panel. Enforced by the `cva-variants-have-storybook-argtypes` structural lint check ([scripts/lint-standards.ts](scripts/lint-standards.ts)) and the `webapp-ui-primitive` skill § Stories contract.

---

## When to use a different prompt instead

| Symptom | Use instead |
|---|---|
| Only one primitive needed | `figma-component.md` |
| Only one screen needed | `figma-page.md` |
| Touching backend (new domain, new endpoint) | `new-domain.md` / `new-feature.md` first |
| Mobile screens needed | This prompt covers web only — chain `mobile-new-screen` skill afterward |
| Re-running because `/design-preview` is broken but the rest is fine | Answer "preview-only" to Phase 0 question 9 (added below) — skips B.1, B.3, B.4, B.5, B.6 and re-runs B.2.5 only |
