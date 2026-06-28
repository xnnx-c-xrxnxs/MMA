---
name: figma-to-ui-component
description: Convert a Figma component (typically from the Untitled UI base file or any Figma node provided by the designer) into a primitive in @mma/ui (web) and, when applicable, mirror it in @mma/mobile-ui. Use this whenever the user pastes a Figma URL, references a Figma node, or asks to "implement this design". Codifies token mapping, variant mapping, and the shadcn-style adaptation rules tuned to this codebase.
---

# Figma → @mma/ui Component

This skill is the **happy path** for the Figma MCP integration. It runs whenever a Figma node should become a React component in `@mma/ui` (and optionally a React Native component in `@mma/mobile-ui`).

> **Hard rule:** Never paste raw Figma-MCP output (with `bg-[#7f56d9]`, `data-node-id`, inline hex, anonymous div soup) into a source file. Always adapt it through the rules below first.

---

## Canonical references (read these to ground your output)

- Tokens: [packages/ui/src/lib/tokens.ts](packages/ui/src/lib/tokens.ts) — single source of truth for colors / spacing / radii / typography (Golden Rule #23j).
- Tailwind theme + dark-mode overrides: [apps/webapp/src/app/globals.css](apps/webapp/src/app/globals.css)
- Existing primitives (study these before adding anything new):
  - With variants: [packages/ui/src/components/form-controls/button/button.tsx](packages/ui/src/components/form-controls/button/button.tsx), [packages/ui/src/components/data-display/badge/badge.tsx](packages/ui/src/components/data-display/badge/badge.tsx)
  - No variants: [packages/ui/src/components/form-controls/input/input.tsx](packages/ui/src/components/form-controls/input/input.tsx)
  - Compound: [packages/ui/src/components/data-display/card/card.tsx](packages/ui/src/components/data-display/card/card.tsx), [packages/ui/src/components/feedback/dialog/dialog.tsx](packages/ui/src/components/feedback/dialog/dialog.tsx)
- Mobile mirrors: [packages/mobile-ui/src/components/button.tsx](packages/mobile-ui/src/components/button.tsx), [packages/mobile-ui/src/components/badge.tsx](packages/mobile-ui/src/components/badge.tsx)
- Sister skills (chain into them): `webapp-ui-primitive`, `mobile-ui-primitive`, `webapp-radix-primitive-wrap`, `fe-design-tokens`.

---

## Phase 0 — Required information (ASK before tool calls)

1. **Figma URL or node id?** (need `fileKey` + `nodeId` — see URL parsing rules below)
2. **Component name** in our codebase (e.g. `Switch`, `Tabs`, `IconButton`)
3. **Does this component already exist in `@mma/ui`?**
   - List `packages/ui/src/components/` and check.
   - If **yes** → this is an *update*; produce a diff vs the existing file, do NOT recreate.
   - If **no** → this is a *new primitive*; chain into the `webapp-ui-primitive` skill.
4. **Mirror to mobile?** (default **yes** for atomic primitives like Button/Input/Badge; default **no** for web-only primitives like DropdownMenu/Command/Popover that have no native equivalent)
5. **Needs Radix (focus management, portals, a11y)?** If yes → also load the `webapp-radix-primitive-wrap` skill. Examples: Dialog, DropdownMenu, Tooltip, Popover, Tabs, Sheet, AlertDialog.

If any answer is unclear, ask the user. Do not guess.

---

## Phase 1 — Pull the design from Figma

URL parsing (from the Figma MCP top-level instructions):
- `figma.com/design/:fileKey/:fileName?node-id=:nodeId` → convert `-` to `:` in nodeId
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use `branchKey` as fileKey
- `figma.com/make/:makeFileKey/:makeFileName` → use `makeFileKey`

Run these in parallel:

1. `mcp__figma2__get_design_context` — returns reference React + Tailwind + screenshot
2. `mcp__figma2__get_variable_defs` — returns the design tokens used in this node
3. `mcp__figma2__get_metadata` — returns the variant property names (e.g. `Size=sm, Icon=False`)

Then **pause and reason** about the output. Do NOT start coding yet.

---

## Phase 2 — Token mapping (the core of the skill)

Figma reference output uses Untitled UI's variable names + raw hex literals. They MUST be remapped to our semantic Tailwind utilities so `tokens.ts` stays the single source of truth.

### 2a. Colour-variable mapping table

| Untitled UI variable | Raw hex (today) | Use in code | Notes |
|---|---|---|---|
| `Brand/600` | `#7F56D9` (purple) | `bg-primary` / `text-primary-foreground` | Brand primary action |
| `Brand/700` | darker purple | `hover:bg-primary/90` (no separate token) | Hover state of primary |
| `Base/White` | `#FFFFFF` | `bg-background` / `text-primary-foreground` | Depending on context |
| `Base/Black` / `Gray/900` | `#0a0a0a` | `text-foreground` | Body text |
| `Gray/700` / `Gray/600` | mid-grays | `text-muted-foreground` | Secondary text, helper text |
| `Gray/200` / `Gray/300` | light borders | `border-input` / `border` | Borders, dividers |
| `Gray/50` / `Gray/100` | surface gray | `bg-muted` / `bg-secondary` | Subtle surfaces, hover |
| `Error/600` (red) | `#ef4444`-ish | `bg-destructive` / `text-destructive-foreground` | Destructive actions |
| `Success/600` (green) | green | `bg-[--color-success-bg] text-[--color-success-text]` | Use semantic success tokens |
| `Warning/600` (yellow) | yellow | `bg-[--color-warning-bg] text-[--color-warning-text]` | Use semantic warning tokens |

If Figma exposes a colour that has **no semantic equivalent** in `tokens.ts` (e.g. an info blue, a brand secondary): **STOP** — chain into the `fe-design-tokens` skill to add the token to BOTH `lightColors` and `darkColors` AND mirror it in `globals.css` (`@theme` and `.dark` blocks). Never inline a hex literal in a primitive.

### 2b. Typography mapping

Figma's text styles map to Tailwind utilities:

| Figma style | Tailwind |
|---|---|
| `Text xs/Regular` | `text-xs font-normal` |
| `Text sm/Regular` | `text-sm font-normal` |
| `Text sm/Medium` | `text-sm font-medium` |
| `Text sm/Semibold` | `text-sm font-semibold` |
| `Text md/...` | `text-base ...` (Tailwind has no `text-md`) |
| `Text lg/...` | `text-lg ...` |
| `Display xs/Semibold` | `text-2xl font-semibold tracking-tight` |
| `Display sm/Semibold` | `text-3xl font-semibold tracking-tight` |
| `Display md/Semibold` | `text-4xl font-semibold tracking-tight` |

Always use Tailwind utilities — never hard-code `font-['Inter:Semi_Bold',sans-serif]` or `leading-[20px]` from the Figma output.

### 2c. Spacing / radii mapping

Figma `padding: 8px 14px` and `gap: 8px` ⇒ use Tailwind's standard scale. Round to nearest:
- `4 → 1`, `8 → 2`, `12 → 3`, `14 → 3.5`, `16 → 4`, `24 → 6`, `32 → 8`.

Figma `rounded-[8px]` ⇒ `rounded-md` (matches our `radii.md`). `rounded-[12px]` ⇒ `rounded-lg`. Never keep `rounded-[Npx]` arbitrary literals.

### 2d. Shadows

`Shadow/xs` → `shadow-sm`. `Shadow/sm` → `shadow`. `Shadow/md` → `shadow-md`. Never keep `shadow-[0px_1px_2px_0px_rgba(...)]`.

---

## Phase 3 — Variant mapping (cva)

Figma component-property names map directly to cva variant keys:

| Figma name | cva pattern |
|---|---|
| `Size=sm` / `Size=md` / `Size=lg` | `size: { sm: ..., md: ..., lg: ... }` |
| `Hierarchy=Primary` / `Secondary` / `Tertiary` | `variant: { default: ..., secondary: ..., ghost: ... }` (rename to our convention) |
| `State=Default` / `Hover` / `Focused` / `Disabled` | NOT a cva variant — use Tailwind state utilities (`hover:`, `focus-visible:`, `disabled:`) |
| `Icon=False` / `Icon=Leading` / `Icon=Only` | Either a `size: 'icon'` variant (icon-only) OR omit and let consumer pass children |

Map Untitled UI's `Hierarchy` values to OUR canonical variant names: `Primary → default`, `Secondary → secondary`, `Tertiary → ghost`, `Link → link`, `Destructive → destructive`. This keeps the API consistent with the existing Button.

---

## Phase 4 — Adaptation rules (transform reference code → final code)

When translating Figma's React+Tailwind reference to our primitive, apply ALL of these:

1. **Strip everything Figma-specific:**
   - Remove every `data-node-id="..."` attribute.
   - Remove `content-stretch`, `shrink-0`, `relative` (unless layout actually requires it), `overflow-clip`, `not-italic`, `whitespace-nowrap` (unless intentional).
   - Remove `font-['Inter:...',sans-serif]` — the global stylesheet sets the font family.

2. **Replace inline literals with semantic tokens** using the Phase 2 tables. ZERO hex literals, ZERO `rounded-[Npx]`, ZERO `text-[Npx]` should remain.

3. **Wrap classes in `cn()`** from `../../../lib/utils` (3 levels up from `components/{category}/{name}/{name}.tsx`) so consumers can override via `className`.

4. **Wrap variant logic in `cva`** if the component has more than one visual variant; otherwise inline a static `cn()`.

5. **Render the right HTML element.** Figma always emits `<div>`. Use:
   - `<button>` for clickable actions
   - `<a>` for links
   - `<input>` / `<textarea>` for text entry
   - `<label>` for labels
   - `<span>` for inline tags / badges
   - `<div>` only for layout/containers (Card, etc.)

6. **Accept `ref` as a regular prop** (React 19) for any primitive that wraps a single underlying HTML element. No `forwardRef` needed. Pattern shown in [packages/ui/src/components/form-controls/button/button.tsx](packages/ui/src/components/form-controls/button/button.tsx).

7. **Props extend the underlying element's HTML attributes** + `VariantProps<typeof xxxVariants>` + `{ ref?: React.Ref<HTMLElement> }`. Pattern shown in `ButtonProps` in the same file.

8. **Use named function declarations** so React DevTools shows readable names automatically (no `displayName` needed).

9. **Accessibility on by default:**
   - Buttons get `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` (already in our base classes).
   - Disabled state: `disabled:pointer-events-none disabled:opacity-50`.
   - For interactive primitives needing focus management (Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet): **use Radix** via the `webapp-radix-primitive-wrap` skill — never hand-roll keyboard/focus.

10. **Dark mode is automatic** when you use semantic tokens (`bg-primary`, `text-foreground` etc.) because `globals.css` flips them under `.dark`. If you used a raw hex, dark mode WILL break — go back to Phase 2.

---

## Phase 5 — Mobile mirror (when applicable)

For atomic primitives (Button, Badge, Input, Card, Separator, Text), produce the React Native equivalent in `packages/mobile-ui/src/components/{name}.tsx` AT THE SAME TIME.

Mobile uses `StyleSheet.create()` + theme tokens from `@mma/mobile-ui` — NOT Tailwind. Pattern:
- Import `lightColors` / `darkColors` from `@mma/ui` (re-exported by `@mma/mobile-ui`).
- Use `useColorScheme()` to pick the active palette.
- Variant resolution via a `Record<Variant, ViewStyle>` (no cva — RN can't consume Tailwind classes).
- Use `spacing`, `radii`, `fontSizes` from tokens for numeric values.

See [packages/mobile-ui/src/components/button.tsx](packages/mobile-ui/src/components/button.tsx) for the canonical pattern.

Skip the mobile mirror for: Dialog, DropdownMenu, Popover, Tabs, Tooltip, Command, AlertDialog, Sheet, Form, FileDropzone, DataTable — these are web-only or have RN-native replacements.

---

## Phase 6 — Wire up

1. Add the new file under `packages/ui/src/components/{category}/{name}/{name}.tsx` (with sibling `index.ts`).
2. **Add `{name}.stories.tsx`** in the same folder — see the `webapp-ui-primitive` skill § Stories for the canonical template. At minimum: `Default`, one story per `variant`, one `Sizes` story if the primitive has a size axis.
3. **Add `{name}.spec.tsx`** in the same folder — see the `webapp-ui-primitive` skill § Tests. At minimum: renders children, applies variant class via cva, forwards ref, honours a11y-critical props.
4. Re-export from [packages/ui/src/index.ts](packages/ui/src/index.ts) (alphabetical block).
5. (Mobile) Add file under `packages/mobile-ui/src/components/{name}.tsx` and export from `packages/mobile-ui/src/index.ts`. Mobile does not ship Storybook — RN previewing happens in the Expo dev client.
6. Run `Bash` on all changed files.
7. Run `pnpm nx build ui` and `pnpm nx test ui` (and, if mobile changed, `pnpm nx build mobile-ui`).
8. Run `pnpm nx run ui:build-storybook` to confirm the new story compiles.

---

## Phase 7 — Verify against the design

The authoritative visual reference is **Storybook** — not the webapp. Boot it with `pnpm nx run ui:storybook` (port 4400), navigate to the new story, then run `mcp__figma__get_screenshot` on the source node and compare side-by-side. Flip the theme toolbar in Storybook to verify the dark-mode tokens render correctly without re-rendering the consuming page. Flag any visual delta to the user — don't silently accept "close enough".

If the primitive must be verified in screen context (rare — e.g. it composes with layout from a real page), additionally render it in the existing `/design-preview/components` page (`apps/webapp/src/app/design-preview/components/page.tsx`). That surface stays around for screen-level diff vs Figma; Storybook is the per-primitive surface.

---

## Worked example — Button "Size=sm, Icon=False"

**Figma MCP returned:**
```tsx
<div className="bg-[#7f56d9] border border-[#7f56d9] border-solid content-stretch flex items-center justify-center overflow-clip px-[14px] py-[8px] relative rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" data-node-id="1054:6967">
  <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] not-italic relative shrink-0 text-[14px] text-white whitespace-nowrap" data-node-id="1054:6968">
    Button CTA
  </p>
</div>
```

**Variables observed:** `Brand/600` (#7F56D9), `Base/White`, `Text sm/Semibold`, `Shadow/xs`.

**Variant property:** `Size=sm`.

**Adaptation:** This is the existing `Button` with `variant="default" size="sm"`. The class string in [packages/ui/src/components/form-controls/button/button.tsx](packages/ui/src/components/form-controls/button/button.tsx) (`bg-primary text-primary-foreground shadow ... h-8 rounded-md px-3 text-xs`) already covers it. No code change needed; instead, document the equivalence:

> Untitled UI `Hierarchy=Primary, Size=sm` ⇒ `<Button variant="default" size="sm">`.

This is the pattern for ALL Untitled UI components that already have an equivalent in `@mma/ui`: produce a *mapping note*, not a rewrite.

---

## Anti-patterns (auto-reject)

- Pasting any of these into a source file: `data-node-id`, `bg-[#......]`, `text-[14px]`, `rounded-[8px]`, `font-['Inter:...']`, `shadow-[0px_1px_2px_...]`.
- Adding a primitive directly under `apps/webapp/src/components/` instead of `@mma/ui` (Golden Rule #21).
- Hard-coding hex in a component instead of adding a token (Golden Rule #23j).
- Hand-rolled focus/keyboard handling instead of Radix (Golden Rule #23d).
- Forgetting the mobile mirror for atomic primitives (Mobile Rule #32).
- Forgetting to update `packages/ui/src/index.ts` — the build will succeed but the consumer can't import.
