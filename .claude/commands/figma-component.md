---
description: "Generate ONE shared UI primitive in @mma/ui (and optionally @mma/mobile-ui) from a Figma component URL. USE WHEN the user pastes a Figma URL pointing to a single component / variant set, or says 'build this Figma component', 'generate from this Figma URL', 'translate this Figma node'."
---

# Figma → UI Component (single primitive)

You are orchestrating the generation of **one** shared UI primitive from a Figma component. This is the narrowest of the three Figma workflows — for screens use `figma-page.md`, for whole files use `figma-import.md`.

**Do NOT call any tools or write any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Figma URL?** (must point to a `COMPONENT` or `COMPONENT_SET` node — not a page or arbitrary frame)
2. **Component name in our codebase?** (e.g. `Switch`, `Toast`, `IconButton`)
3. **Mirror to mobile?** (default: yes for atomic primitives like Button/Input/Badge/Avatar; no for web-only primitives like DropdownMenu/Command/Popover that have no native equivalent)
4. **Needs Radix wrapping?** (yes for interactive primitives needing focus/keyboard a11y: Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Command. No for purely visual: Badge, Card, Skeleton, Spinner.)
5. **Replace existing primitive or add new?** (auto-detect by listing `packages/ui/src/components/`)
6. **Testing mode?** (`emit-now` or `defer`; default: `defer`)
   - `emit-now`: run lint/test verification in this workflow.
   - `defer`: generate code only and print a ready-to-run testing block the user can trigger later.

### Auto-Detection

Before asking question 5, list `packages/ui/src/components/` and check whether a primitive with the same name already exists. If yes, surface that as "this is an UPDATE — produce a diff against the existing file" vs "this is a NEW primitive".

**Do not proceed until questions 1–4 and 6 are answered (5 is auto-detected).**

---

## Phase 0.5 — Pre-flight Discovery (parallel)

### 0.5.0 — Load the Figma MCP tools (deferred — REQUIRED FIRST)

The Figma MCP tools (`mcp__figma__*`, `mcp__figma2__*`) are **deferred** — they appear in the `availableDeferredTools` list but are NOT callable until you load them.

1. Call `tool_search(query="figma mcp design metadata variables screenshot whoami")`.
2. If both `mcp__figma__*` and `mcp__figma2__*` come back, prefer `mcp__figma__*`. Use the alternate only if a specific call fails.
3. Confirm auth: `mcp__figma__whoami`.
4. **If `tool_search` returns no Figma tools, STOP** — tell the user the Figma MCP server is not configured. Do NOT fall back to a desktop app or to scraping.

### 0.5.1 — Read-only fan-out (after Figma tools are loaded)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: figma-to-ui-component, webapp-ui-primitive, webapp-radix-primitive-wrap, mobile-ui-primitive, fe-design-tokens")`
- Read the existing barrel: `packages/ui/src/index.ts` (so you know what already exists)
- Read tokens: `packages/design-tokens/src/lib/tokens.ts`
- Read `apps/webapp/src/app/globals.css` (Tailwind v4 hygiene check — confirm `@source` directive for `packages/ui/src` is present + the AUTO-GENERATED `@theme` / `.dark` sentinel block exists). Note: the legacy `.light` mirror block has been REMOVED — light/dark switching is runtime via `<ThemeToggle>` + `next-themes`.

Wait for all to return. Summarize what's already in the design system, and confirm with the user before proceeding.

---

## Phase 1 — Pull the design

### 1.0 — Parse the Figma URL (fail fast on bad input)

Figma tools require `fileKey` + `nodeId` as **separate params**, NOT the raw URL.

| URL pattern | `fileKey` | `nodeId` conversion |
|---|---|---|
| `figma.com/design/:fileKey/:name?node-id=:id` | as-is | replace `-` with `:` (e.g. `14-2` → `14:2`) |
| `figma.com/design/:fileKey/branch/:branchKey/:name` | use `branchKey` | same (`-` → `:`) |
| `figma.com/make/:makeFileKey/:name` | use `makeFileKey` | n/a |
| `figma.com/board/:fileKey/...` | FigJam — not a component target. STOP and ask the user for a design URL. |

If the URL has no `node-id`, this is wrong for a single-component flow — ask the user to select the component in Figma and re-paste with `?node-id=...`. Do NOT guess.

### 1.1 — Fetch

Call in parallel (using `mcp__figma__*`, fall back to `mcp__figma2__*` if a specific call fails):

1. `mcp__figma__get_metadata({ fileKey, nodeId })` — node tree
2. `mcp__figma__get_screenshot({ fileKey, nodeId })` — visual reference
3. `mcp__figma__get_design_context({ fileKey, nodeId })` — reference React + Tailwind (treat as guidance, not source of truth)
4. `mcp__figma__get_variable_defs({ fileKey, nodeId })` — tokens used

**STOP. Do not start coding yet.**

---

## Phase 1.5 — Icon check

Before writing any code, scan the Figma metadata / screenshot for icon components used inside the primitive.

For each icon found:

1. Check `packages/ui/src/icons/icons.tsx` — is it defined as an `export const`? (**Not** `index.ts` — that barrel can have ghost entries that don't compile.)
2. If **yes** → note the export name and continue.
3. If **no** → follow `svg-to-icons.md` to add it:
   - Ask the user to paste the SVG markup for the missing icon (or export it from Figma)
   - Run the `svg-to-icons.md` flow to add it to `icons.tsx` + `index.ts`
   - Verify with `pnpm nx lint ui` before continuing
4. Once **all** icons used by this component exist in the barrel, proceed.

> **Rule:** Never implement a component that imports a non-existent icon. Icons must be in the barrel before the component is written.

---

## Phase 2 — Token reconciliation

For every Figma Variable bound on the component:

| Action | When |
|---|---|
| **Map to existing token** | Variable name matches or is a near-match for a token in `packages/ui/src/lib/tokens.ts` |
| **Propose new token** | Variable has no equivalent — surface to user, get approval, then load `fe-design-tokens` skill and add it BEFORE the primitive |

Produce a small table for the user:

```
| Figma variable      | Maps to                     | Action     |
|---------------------|-----------------------------|------------|
| colors/brand        | tokens.lightColors.primary  | reuse      |
| colors/info-bg      | (none)                      | NEW TOKEN  |
```

Wait for approval if any NEW TOKEN rows exist.

If adding tokens, edit `packages/ui/src/lib/tokens.ts` (single source of truth) — add to BOTH `lightColors` AND `darkColors`. Then run `pnpm tokens:gen` to regenerate the `@theme { … }` and `.dark { … }` blocks between the AUTO-GENERATED sentinels in `globals.css`. **Never hand-edit those blocks.** CI runs `pnpm tokens:check` and fails on drift. The legacy `.light` mirror block is gone — do NOT re-add it.

---

## Phase 3 — Generate the web primitive

**Load skill:** `.claude/skills/figma-to-ui-component/SKILL.md`
**Load skill:** `.claude/skills/webapp-ui-primitive/SKILL.md` (always)
**Load skill:** `.claude/skills/webapp-radix-primitive-wrap/SKILL.md` (only if Phase 0 Q4 = yes)

### 3.0 — Scaffold with the generator (NEW primitives only; skip for updates)

Run the generator to produce the four-file skeleton before filling anything in:

```sh
pnpm nx g @mma/nx-plugin:ui-primitive \
  --name={Name} \
  --category={category} \
  --pattern={simple-variants | simple-no-variants | compound}
```

Pattern selection:
- `simple-variants` — has Figma variant axes (size, intent, state) → maps to `cva`
- `simple-no-variants` — visual only, no axes
- `compound` — multiple sub-components (Dialog, Card, Table)

The generator creates `{name}.tsx`, `index.ts`, `{name}.stories.tsx`, `{name}.spec.tsx` and registers the export in `packages/ui/src/index.ts`. Confirm all four files exist before continuing.

For **updates** (primitive already exists): skip the generator — edit the existing files in place.

### 3.1 — Fill in `{name}.tsx`

1. Map Figma variant axes → `cva` variant axes 1:1
2. Use `cn()` from `'../../../lib/utils'` (3 levels up from the new file)
3. Use `forwardRef` for any primitive that wraps a focusable element
4. Use semantic Tailwind utilities (`bg-card`, `text-muted-foreground`) — NEVER inline hex
5. If Radix-backed (Phase 0 Q4 = yes), replace the `<div>` stub from the generator with the Radix root following the `webapp-radix-primitive-wrap` skill

### 3.1.1 — Form-like layout rule (MANDATORY when applicable)

If the component is a **form-like layout** (form container, form section, grouped field layout, or settings form composition), the generated layout MUST follow the canonical structure pattern from `packages/ui/src/components/form-controls/form/form.stories.tsx`:

- Define a typed `managedSchema`.
- Define typed `managedStructure: FormStructure<...>`.
- Use `StructuredForm` for layout rendering.
- Keep the same RHF + schema-driven pattern (do not fall back to ad-hoc layout wiring).

Scope guard:
- This rule applies only to form-like component layouts.
- Non-form primitives continue with the standard `cva` / Radix generation rules above.

### 3.2 — Fill in `{name}.stories.tsx`

Replace the generator's placeholder `args` with real examples derived from the Figma variants detected in Phase 1:

- One story per major variant axis value (e.g. `Primary`, `Secondary`, `Destructive` for a Button)
- One story per size when the component has a size axis
- One `Dark` story that wraps in `<div className="dark">` to verify dark-mode tokens
- Use the Figma screenshot from Phase 1.1 as the visual reference — match copy and layout

When the generated primitive is form-like, include at least one story that demonstrates the `managedSchema` + `managedStructure` + `StructuredForm` pattern.

### 3.3 — Fill in `{name}.spec.tsx`

Ensure the spec covers:
- Renders without crashing (snapshot or `toBeInTheDocument`)
- Each `cva` variant applies the expected class (query by role + check `className`)
- `forwardRef` wires through (if applicable)
- `displayName` is set

### 3.4 — Verify

```sh
pnpm nx lint ui --skip-nx-cache
pnpm nx test ui --skip-nx-cache
```

> **Note:** `@mma/ui` has no standalone `build` target — TypeScript is validated through `test` (jest type-checks) and `build-storybook`. Do not run `pnpm nx build ui`.

Fix any errors before proceeding.

Form-like verification checkpoint:
- Confirm the implementation follows the `managedSchema` + `managedStructure` pattern from `packages/ui/src/components/form-controls/form/form.stories.tsx`.

### 3.5 — Testing Emission Mode (NEW)

Use the answer from Phase 0 Q6:

- If `emit-now`:
   - Continue with the verification steps in this prompt (lint/test/storybook as applicable).
- If `defer`:
   - Skip running verification commands now.
   - Emit a **Testing Trigger Block** in the response for the user to run later.
   - The block must include the exact commands for this component workflow:

```sh
pnpm nx lint ui --skip-nx-cache
pnpm nx test ui --skip-nx-cache
pnpm nx run ui:build-storybook --skip-nx-cache
```

   - Also include a one-line trigger hint the user can paste later in chat:

```text
Trigger testing: "run figma-component testing now"
```

---

## Phase 4 — Mirror to mobile (only if Phase 0 Q3 = yes)

**Load skill:** `.claude/skills/mobile-ui-primitive/SKILL.md`

Then:

1. Create `packages/mobile-ui/src/components/{name}.tsx`
2. Use the variant-record pattern (object literal mapping variant → `StyleSheet`)
3. Use theme tokens from `@mma/mobile-ui` (re-exports `@mma/ui` tokens)
4. Same prop names as web (with `style` instead of `className`, `accessibilityLabel` instead of `aria-label`)
5. Export from `packages/mobile-ui/src/index.ts`

Verify:

```powershell
pnpm nx lint mobile-ui
pnpm nx build mobile-ui
```

---

## Phase 5 — Visual check (Storybook)

`pnpm nx test ui` does NOT prove primitives render correctly — Tailwind v4 silently drops uncovered utilities, and `cva()` strings are invisible to the compiler. Use **Storybook** (already set up, no scaffolding needed) as the visual verification step.

```sh
pnpm nx run ui:storybook
```

Open `http://localhost:4400`, find the new/updated primitive's story, A/B against the Figma screenshot from Phase 1.1. Toggle dark mode via the `@storybook/addon-themes` toolbar. Verify all variants render with correct colors and non-zero dimensions.

If a story shows unstyled elements (0×0, wrong colors):

1. **0×0** → `globals.css` or `preview.css` missing `@source "../../../../packages/ui/src"` directive
2. **Wrong color** → `pnpm tokens:gen` not run — `tokens.css` is stale
3. **Dark mode shows light values** → token added to `lightColors` only, not `darkColors`

If a scanned page uses this primitive, add it to `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts`.

> Design Preview page (`/design-preview`) is optional — scaffold it via `figma-import.md` Phase B.6.5 only if your team wants a persistent side-by-side reference hub.

Old step 4 (running webapp):  
   ```sh
   pnpm nx run webapp:dev
   ```
   Open `http://localhost:4200/design-preview`, find the new section, A/B against the Figma screenshot. Toggle dark mode. Verify all variants render with non-zero dimensions and correct colors.
5. If the primitive will appear on a scanned page, add it to `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts` (load the `fe-accessibility-audit` skill if violations appear).

**Symptoms and fixes:**

| Symptom | Likely cause |
|---|---|
| Primitive renders as 0×0 | `globals.css` missing `@source "../../../../packages/ui/src"` directive |
| Wrong colors | Token added to `tokens.ts` but `pnpm tokens:gen` not run — the `@theme` / `.dark` AUTO-GENERATED block in `globals.css` is stale |
| Dark mode shows light values | Token added to `lightColors` only, not `darkColors` |

If any of these fire, fix `globals.css` first — do NOT work around in the primitive.

---

## Phase 6 — Final verification

Run this phase **only when Phase 0 Q6 = `emit-now`**.

```powershell
pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui
```

If Phase 0 Q6 = `defer`, do not run commands here. Instead, output the Testing Trigger Block from Phase 3.5.

Report what was created / updated. Suggest a commit message:

```
feat(ui): add <Name> primitive from Figma

Generated from Figma node {nodeId} in file {fileKey}.
Variants: {variant axes}
Mobile mirror: {yes|no}
```

---

## When to escalate to a different prompt

| Symptom | Use instead |
|---|---|
| The URL points to a page-level frame (Dashboard, Settings) | `figma-page.md` |
| The URL points to a Figma file with many components | `figma-import.md` |
| User wants the primitive AND a page using it | This prompt first, then `figma-page.md` |
