---
description: "Generate ONE Figma page/frame from a natural-language brief, a page spec (.specs/page-*.yaml), or an existing webapp route — using @old-st/ui components as published in the Figma library. Reverse direction of /figma-page (code → Figma instead of Figma → code). USE WHEN a UI/UX designer says 'build this page in Figma using our components', 'draft a Figma mock from this spec', 'mirror the /users page back into Figma', or asks to compose a Figma frame from design-system primitives."
---

# UI Components → Figma Page (single screen)

You are orchestrating the generation of **one** Figma page/frame composed of `@old-st/ui` component instances. The output is a Figma frame in a designer-supplied file — NOT a Next.js page (for that, use `figma-page.md`).

**Do NOT call any tools or write to Figma until Phase 0 (Interview) is complete AND the Phase 2 plan table is APPROVED by the designer.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required — common to all modes

1. **Target Figma file URL** — paste a `figma.com/design/{fileKey}/...` URL. (Do not guess — `figma.fileKey` returns `"headless"` in MCP context.)
2. **Target page in that file** — existing page name, OR `"create new page named X"`.
3. **Page name** — e.g. `Orders Dashboard`. Becomes the frame name.
4. **Theme** — `light`, `dark`, or `both` (one frame per mode).
5. **Viewport** — `desktop` (1440×900 default), `tablet` (768), `mobile` (375), or a list.

### Mode selection — pick ONE

- **Mode A — Natural-language brief.** Designer describes the layout in prose, naming `@old-st/ui` primitives.
- **Mode B — Page spec file.** Designer provides a `.specs/page-*.yaml` path (same shape as `/webapp-feature` input).
- **Mode C — Mirror an existing webapp route.** Designer gives a route path (e.g. `/users`); the orchestrator captures the live page as a pixel-perfect reference AND builds a design-system version next to it.

### Mode-specific follow-ups

- **Mode A:** Provide the layout description. Encourage section-by-section:
  > *Top-to-bottom*: Header (logo, search, avatar). Then 2-col row 70/30: left = DataTable[Status, Customer, Total, Date] with Badge variants {PAID:success, PENDING:warning, FAILED:destructive}, right = Card "Recent Activity" with 5 stacked rows. Footer-row: Card with Button(variant=primary, label="Export CSV") aligned right.
- **Mode B:** Confirm the spec path (use `parse-page-spec` skill to load it).
- **Mode C:**
  - Route path (e.g. `/(protected)/orders/[orderId]`).
  - Is the webapp running locally (`pnpm nx run webapp:dev`) or via a preview URL? Need a reachable URL for `generate_figma_design`.
  - Mock data or live data when capturing the reference?

**Do not proceed until questions 1–5 + the mode-specific follow-ups are answered.**

---

## Phase 0.5 — Pre-flight discovery (parallel, read-only)

### 0.5.0 — Load the Figma MCP tools (deferred — REQUIRED FIRST)

The Figma MCP tools are **deferred** — they appear in `availableDeferredTools` but are NOT callable until you load them.

1. `tool_search(query="figma mcp design metadata variables screenshot use_figma search_design_system libraries whoami")`.
2. Prefer `mcp__figma__*` over `mcp__figma2__*`; use the alternate only if a call fails.
3. **If the search returns no Figma tools, STOP** and tell the designer the Figma MCP server is not configured. Do not fall back to desktop app screenshots.

### 0.5.1 — Read-only fan-out

Run in parallel after Figma tools are loaded:

- `mcp__figma__whoami` — confirm auth + team. If unauthenticated, STOP.
- `mcp__figma__get_libraries({ fileKey })` — confirm `@old-st/ui` is enabled in the target file. **If not, STOP** and tell the designer to enable it via Figma → Assets → Libraries.
- `mcp__figma__get_metadata({ fileKey, nodeId: target page })` — confirm the target page exists; if `"create new page named X"` was requested, note that Phase 3 must create it.
- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: ui-to-figma-page, figma-to-ui-screen, figma-to-ui-component, parse-page-spec")`
- Read [packages/ui/src/index.ts](packages/ui/src/index.ts) — authoritative inventory of primitives that *should* have Figma counterparts.

Cross-check: every primitive named in the brief/spec MUST appear in `packages/ui/src/index.ts` AND be discoverable in the Figma library via `search_design_system`. (Note: Figma Code Connect is not used in this template — it requires Figma Organization/Enterprise. Primitive↔component pairing is by name match, not by Code Connect map lookup.)

### 0.5.2 — Parse the Figma URL (fail fast)

| URL pattern | `fileKey` |
|---|---|
| `figma.com/design/:fileKey/:name` | as-is |
| `figma.com/design/:fileKey/branch/:branchKey/:name` | use `branchKey` |
| `figma.com/board/...` | FigJam — REJECT. Ask for a design URL. |
| `figma.com/make/...` | REJECT for this workflow. |

If a `node-id` is included, convert `-` → `:` (e.g. `14-2` → `14:2`). The target page nodeId is what you pass to `get_metadata` in 0.5.1.

---

## Phase 1 — Mode-specific input load

### Mode A — already have the brief
Proceed to Phase 2 with the brief as input.

### Mode B — load the spec
**Load skill:** `.claude/skills/parse-page-spec/SKILL.md`

Read the YAML at the supplied path, validate against the schema, and produce the in-memory page summary (sections[], component refs, props). If validation fails, STOP and report the schema errors to the designer.

### Mode C — capture the live route
Run in parallel with Phase 2 decomposition:

1. Confirm the webapp URL is reachable (curl or `mcp__figma__*` — do NOT block on this; if unreachable, fall back to Mode A by asking the designer to describe the layout).
2. `mcp__figma__generate_figma_design({ url: "{webapp-url}/{route}", fileKey, pageNodeId })` — creates a pixel-perfect screenshot frame in the target page. Mark this frame as `[REFERENCE — delete before final]` in its name.
3. Use the screenshot from step 2 as the layout reference for Phase 3.

---

## Phase 2 — Decomposition + primitive availability matrix (CHECKPOINT)

**Load skill:** `.claude/skills/ui-to-figma-page/SKILL.md` (read full SKILL.md — it specifies the table format and blocker resolution rules).

Produce the page-build plan table per the SKILL.md Phase 1 format. Include:

- Every section/row/column
- Every primitive instance (with variant + props)
- Status column: `In @old-st/ui?` (and a corresponding match in the Figma library via `search_design_system`)
- Blockers section — list any primitives missing from either side
- Tokens used (from `packages/ui/src/lib/tokens.ts`)

**STOP. Present the table to the designer. Wait for explicit approval ("looks good", "yes", "go").**

Designers regularly correct the AI's primitive choices and resolve blockers (inline-as-frame vs add-to-library). Do not write to Figma until approved.

---

## Phase 3 — Resolve blockers (only if Phase 2 surfaced any)

For each blocker:

| Designer answer | Action |
|---|---|
| "Inline it as plain frames" | Phase 4 uses `figma.createFrame()` for those nodes instead of `use_figma` |
| "Add it to the library first" | **STOP this workflow.** Invoke `figma-to-ui-component` (reverse — to add the primitive to `@old-st/ui` AND its Figma counterpart). Resume here only when the new primitive is published in the Figma library. |
| "Skip that section for now" | Remove from the plan table; proceed with a smaller scope |

---

## Phase 4 — Build the Figma frame

**Load skill:** `.claude/skills/ui-to-figma-page/SKILL.md` (Phase 2 — write-script specifics: `setCurrentPageAsync`, font preload, no `throw`, auto-layout sizing, variable binding).

Execute via `mcp__figma__use_figma` with the assembled instance tree. Build order:

1. Create or select the target page (`setCurrentPageAsync` BEFORE any `createFrame` / `createComponent`).
2. Load every font that will appear (`loadFontAsync`).
3. Create the top-level auto-layout frame at the chosen viewport size, named per Phase 0 Q3.
4. For each section in the approved plan:
   - Create the section frame (auto-layout, padding/spacing from tokens).
   - For each primitive: `search_design_system({ query: primitiveName })` → resolve component key → drop instance with variants + slot overrides.
   - Inline frames for any "inline as frames" blockers from Phase 3.
5. Bind theme-dependent fills to library variables (`setBoundVariableForPaint`). For dark-only or light-only frames, pin the frame to the mode via `setExplicitVariableModeForCollection`.
6. If `theme: both` was selected, repeat step 3–5 for the second theme — second frame placed to the right with `[Dark]` / `[Light]` suffix.

**Reminder: never `throw` in a write script — it rolls back all mutations. Use `figma.notify(...)` and return; verify with a separate read script in Phase 5.**

---

## Phase 5 — Verification (read-only)

Run in parallel:

1. `mcp__figma__get_metadata({ fileKey, nodeId: newFrameId })` — confirm child count matches the plan table.
2. `mcp__figma__get_screenshot({ fileKey, nodeId: newFrameId })` — visual check. Clamps to ~1024×640; for taller frames also screenshot key child sections.
3. Spot-check 3–5 instances: confirm via `get_metadata` that each has a non-null `mainComponent` whose `key` resolves through `search_design_system` to a library component — proves they're library instances, not detached copies.

Report to the designer:

- Deep-link URL to the frame (with `nodeId`)
- Primitives used (count per primitive)
- Tokens used
- Theme(s) produced + viewport(s)
- How each Phase 3 blocker was resolved

---

## Phase 6 — Cleanup (Mode C only)

If a `[REFERENCE — delete before final]` frame was generated in Phase 1, delete it now (via a write script — same `use_figma` invocation pattern). Confirm with the designer first if they want to keep it as side-by-side reference.

---

## Phase 7 — Round-trip handoff (informational)

Tell the designer the generated frame URL is now a valid input for `/figma-page` — an engineer can paste it back to generate the Next.js page wired with the same primitives. This is the bidirectional invariant of this workflow.

If they iterate on the Figma frame, re-running `/ui-to-figma-page` with the same input WILL overwrite the frame — preserve manual edits by renaming first, or run `/figma-page` to pull changes into code.

---

## When to escalate to a different prompt

| Symptom | Use instead |
|---|---|
| Need to ADD a primitive to `@old-st/ui` + Figma library first | `figma-component.md` (reverse mode if it doesn't exist in Figma yet — otherwise add the code primitive manually) |
| Need to BUILD the Next.js page from an existing Figma frame | `figma-page.md` (the reverse direction of this prompt) |
| Need to import an entire Figma file (multiple pages + library) | `figma-import.md` |
| Designer wants a code-side spec, not a Figma frame | `new-page-spec.md` |
