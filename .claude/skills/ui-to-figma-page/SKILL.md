---
name: ui-to-figma-page
description: Generate a Figma page/frame from a natural-language brief, a page spec (`.specs/page-*.yaml`), or an existing webapp route, using the `@mma/ui` design system as published in Figma. Reverse direction of `figma-to-ui-screen` — code/spec → Figma. Use this when a UI/UX designer asks the AI to "build this page in Figma using our components", "draft a Figma mock for the orders dashboard from this spec", or "mirror the production /users page back into Figma".
---

# UI Components → Figma Page

This skill produces a **Figma page/frame composed of `@mma/ui` design-system component instances**. It is the *inverse* of `figma-to-ui-screen` — input is a brief / spec / live route, output is a Figma frame.

> **Hard rule:** Every interactive surface in the generated Figma frame MUST be a component instance from the Figma library backing `@mma/ui`. If `search_design_system` cannot resolve a primitive, STOP and ask — do not draw a raw rectangle/text. Missing primitives must be added to the Figma library first (via `figma-to-ui-component` in reverse).

---

## Canonical references

- Sibling (reverse direction): `figma-to-ui-screen` (Figma → code), `figma-to-ui-component` (Figma → primitive)
- Primitive barrel (full inventory): [packages/ui/src/index.ts](packages/ui/src/index.ts)
- Page spec schema: `.specs/page-*.yaml` (consumed by `/webapp-feature` — same shape is reused here)
- Tokens (must match Figma library variables): [packages/ui/src/lib/tokens.ts](packages/ui/src/lib/tokens.ts)
- Figma MCP gotchas: see user-memory `figma-mcp.md` (fonts, async variable APIs, `setCurrentPageAsync`, auto-layout sizing).

> **Note on Code Connect:** This template does NOT use Figma Code Connect — it requires Figma Organization/Enterprise. Code↔component pairing is by **name match** between `packages/ui/src/index.ts` and `mcp__figma__search_design_system` results, not by `get_code_connect_map` lookup. All references to the Code Connect map in older revisions of this skill have been removed.

---

## Phase 0 — Required information (ASK before tool calls)

The skill accepts ONE of three input modes. Ask the designer which they're providing, then ask the mode-specific follow-ups.

### Mode A — Natural-language brief

1. **Page name** (e.g. "Orders Dashboard") — becomes the Figma frame name.
2. **Target Figma file** — paste the `figma.com/design/{fileKey}/...` URL of the file to write into. (`figma.fileKey` returns `"headless"` in MCP context — the URL is the only reliable source.)
3. **Target page in that file** (existing page name, or "create new page named X").
4. **Layout description** — sections, columns, primitives, states. Encourage the format:
   > *Top-to-bottom*: Header (logo, search, avatar). Then 2-col row 70/30: left = DataTable[Status, Customer, Total, Date] with Badge variants {PAID:success, PENDING:warning, FAILED:destructive}, right = Card "Recent Activity" with 5 stacked rows. Footer-row: Card with Button(variant=primary, label="Export CSV") aligned right.
5. **Theme / mode** — light, dark, or both (one frame per mode).
6. **Viewport** — desktop (1440×900 default), tablet, mobile, or all three.

### Mode B — Page spec file

1. **Spec path** — e.g. `.specs/page-orders-dashboard.yaml`.
2. **Target Figma file URL + page** (same as Mode A questions 2–3).
3. **Theme / viewport** (same as Mode A questions 5–6).

The spec is parsed by the `parse-page-spec` skill (reuse — do not re-implement). The same `sections[]` / `component:` / `props:` shape used to generate the Next.js page drives the Figma layout.

### Mode C — Mirror an existing webapp route

1. **Route path** — e.g. `/users`, `/(protected)/orders/[orderId]`.
2. **Target Figma file URL + page**.
3. **Theme / viewport**.
4. **Live data or mock data?** — if live, the skill uses `mcp__figma__generate_figma_design` against the running webapp URL as a pixel-perfect reference *and* `use_figma` with design-system instances. If mock, only `use_figma`.

**Do not proceed until all questions are answered.** Do not guess the Figma file URL — the designer must supply it.

---

## Phase 0.5 — Pre-flight discovery (parallel, read-only)

Load Figma MCP tools first (they are deferred):

1. `tool_search(query="figma mcp design metadata variables screenshot use_figma search_design_system whoami")`.
2. `mcp__figma__whoami` — confirm auth + which Figma team/account is active. If unauthenticated, STOP.
3. `mcp__figma__get_libraries` — list the libraries available in the target file. Confirm the `@mma/ui` library is enabled in that file. **If it is not, STOP** and tell the designer to enable the library in Figma (Assets panel → Libraries → enable `@mma/ui`) before continuing.
4. `mcp__figma__get_metadata({ fileKey, nodeId: target page })` — confirm the target page exists; if "create new page named X" was requested, note that Phase 2 must create it via `setCurrentPageAsync`.
5. Read [packages/ui/src/index.ts](packages/ui/src/index.ts) — the authoritative inventory of primitives that *should* have Figma counterparts.

Cross-check: every primitive named in the brief/spec MUST appear in `packages/ui/src/index.ts` AND be resolvable in the Figma library via `mcp__figma__search_design_system({ query: primitiveName })`. Name mismatches are surfaced in Phase 1.

---

## Phase 1 — Decomposition + primitive availability matrix (CHECKPOINT)

Produce a **page-build plan table** as your first output. Format:

```markdown
### Figma page: Orders Dashboard
**Target:** figma.com/design/{fileKey} → page "Marketing Mocks" (existing)
**Viewport:** Desktop 1440×900, dark mode
**Library coverage:** 8/9 primitives resolved via `search_design_system`

| Section | Layout | Primitive | Variant / props | In `@mma/ui`? | Resolves in Figma library? |
|---|---|---|---|---|---|
| Header | Frame, horizontal, space-between | `Header` | — | ✅ | ✅ |
| Header > search | inline | `Input` | placeholder="Search orders" | ✅ | ✅ |
| Header > avatar | inline | `Avatar` | size=sm, fallback="JD" | ✅ | ✅ |
| Body > left col (70%) | Frame, vertical | `DataTable` | columns=[Status,Customer,Total,Date], rows=5 (mock) | ✅ | ✅ |
| Body > left col > status cell | inside DataTable | `Badge` | variant=success / warning / destructive | ✅ | ✅ |
| Body > right col (30%) | Frame, vertical | `Card` | title="Recent Activity" | ✅ | ✅ |
| Body > right col > rows | inside Card | `ActivityRow` | — | ❌ NOT a primitive | ❌ — must be drawn as plain frames OR added to library first |
| Footer | Frame, horizontal, justify-end | `Card` | — | ✅ | ✅ |
| Footer > CTA | inside footer Card | `Button` | variant=primary, label="Export CSV" | ✅ | ✅ |

**Blockers:**
- `ActivityRow` is not a primitive. Choose one:
  - (a) Inline it as a plain auto-layout frame (Text + Text + Badge) — no library entry needed.
  - (b) Pause this skill, run `figma-to-ui-component` to add `ActivityRow` to `@mma/ui` + Figma library first, then resume.

**Tokens used:** color.bg.surface, color.text.primary, color.text.muted, spacing.md, radius.lg
```

**This is a CHECKPOINT.** Show it to the designer and **wait for confirmation** before writing to Figma. They will resolve blockers (pick (a) or (b)) and may want to adjust layout decisions.

---

## Phase 2 — Build the Figma frame

Only after the designer approves the plan.

### 2.1 Page setup (write-script gotchas — see user-memory `figma-mcp.md`)

- If creating a new page: `await figma.setCurrentPageAsync(newPage)` **before** any `figma.createFrame()` / `figma.createComponent()` call.
- Load every font that will appear: `await figma.loadFontAsync({ family, style })` BEFORE setting any text or `textAutoResize` — including on existing text nodes.
- **Never `throw new Error()` in a write script** — it rolls back all mutations. Use `figma.notify(...)` and let the script return; verify with a separate read script.

### 2.2 Layout — auto-layout everywhere

- Top-level frame: `layoutMode = "VERTICAL"`, `primaryAxisSizingMode = "AUTO"`, `counterAxisSizingMode = "FIXED"`, fixed width to the chosen viewport (1440 / 768 / 375).
- For HORIZONTAL rows: `primaryAxis = width`, `counterAxis = height`. Default `counterAxisSizingMode` is `"FIXED"` at a small height — explicitly set both axes to `"AUTO"` for hug-content (gotcha from memory).
- Spacing/padding: use token values from `packages/ui/src/lib/tokens.ts` so the frame stays in lock-step with `@theme` in `globals.css`.

### 2.3 Drop component instances (the core)

For each row in the plan table where the primitive resolves in the Figma library:

1. `mcp__figma__search_design_system({ query: primitiveName })` → returns the library component key.
2. `mcp__figma__use_figma` with an instance-creation payload that sets:
   - the resolved component key,
   - variant properties (e.g. `Variant=primary`, `State=default`, `Size=md`),
   - text/icon overrides for slot props,
   - parent = the auto-layout frame from Phase 2.2.
3. Bind colors that are theme-dependent to library variables: `figma.variables.setBoundVariableForPaint(paint, "color", variable)` returns a NEW paint — reassign `node.fills = [newPaint]` wholesale (do not mutate in place).
4. To pin the frame to a specific mode (e.g. dark): `frame.setExplicitVariableModeForCollection(collection, modeId)`.

### 2.4 Mock data

- Tables/lists: 5 rows of plausible mock data (e.g. customer names from `Lorem`, statuses cycling through every variant so the designer sees all Badge colors).
- Numeric columns: realistic ranges, not `123`/`456`.
- Avatars: 2-letter fallbacks (`JD`, `AB`) — do not upload real avatar images unless the designer provides them.

### 2.5 Pixel-perfect reference (Mode C only)

When mirroring a live route, run `mcp__figma__generate_figma_design` against the running webapp URL **in parallel** with the `use_figma` build. It produces a screenshot frame next to the design-system frame. Use it as a layout reference only — **delete it before finalizing** so the file only contains the component-instance version.

---

## Phase 3 — Verification (read-only, after the write script returns)

1. `mcp__figma__get_metadata({ fileKey, nodeId: newFrameId })` — confirm the frame exists and has the expected child count.
2. `mcp__figma__get_screenshot({ nodeId: newFrameId })` — **clamps to ~1024×640** (memory gotcha) so for full-screen frames also dump a child-by-child inventory via `get_metadata` to verify off-screen sections.
3. For each instance in the frame: confirm via `get_metadata` that `mainComponent` is non-null and its `key` resolves through `search_design_system` to a published library component — proves the instance is bound to the library, not a detached copy.
4. Report a summary to the designer:
   - Frame URL (deep link with `nodeId`)
   - Primitives used (count per primitive)
   - Tokens used
   - Any blockers from Phase 1 that were resolved by inlining vs library-adding

---

## Phase 4 — Round-trip handoff

The generated frame is now a valid input for `figma-to-ui-screen` — the engineer can paste its URL back into `/figma-page` and get a Next.js page wired with the same primitives. The bidirectional invariant relies on **consistent primitive naming** between code and the Figma library; if a primitive is renamed on one side, update the other.

If the designer iterates on the Figma frame (moves things, changes variants), re-running this skill with the same spec **will overwrite the previous frame** — preserve the designer's manual edits by renaming the previous frame first, or by running `figma-to-ui-screen` to pull their changes back into the spec.

---

## Anti-patterns (do NOT)

- Draw raw rectangles/text/lines for anything that has a primitive in `@mma/ui`. Always use `use_figma` + `search_design_system`.
- Hard-code colors as hex. Bind to library variables (theme tokens).
- Skip the Phase 1 checkpoint. Designers regularly correct the AI's primitive choices.
- `throw` inside a write script — it rolls back the entire frame.
- Construct a Figma URL from `figma.fileKey` — it returns `"headless"`. Always use the URL the designer supplied.
- Enable Mode C (mirror live route) without confirming the webapp is running locally or in preview — the screenshot capture will hang otherwise.

---

## Checklist

- [ ] Mode (A/B/C) confirmed
- [ ] Target Figma file URL + page confirmed (designer-supplied, not inferred)
- [ ] `@mma/ui` library enabled in the target file (`get_libraries`)
- [ ] Every primitive in the plan resolves via `search_design_system`
- [ ] Plan table presented and APPROVED by designer
- [ ] Blockers (missing primitives) resolved before writing
- [ ] Fonts loaded before any text mutation
- [ ] `setCurrentPageAsync` called before creating frames
- [ ] Theme variables bound (light / dark / both as requested)
- [ ] Verification (`get_metadata` + `get_screenshot`) run after write
- [ ] Frame URL + summary returned to designer
