# @mma/ui Package Context

This file loads automatically for any file inside `packages/ui/`. The package is the **single source of truth for webapp UI primitives** — shadcn-style components built on Radix UI + Tailwind v4 CSS variables.

---

## What This Package Provides

| Subpath | Purpose |
|---|---|
| `src/components/` | shadcn-style primitives (Badge, Button, Card, Table, Input, Select, Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Label, Separator, Command, FormField, Toaster, Skeleton, DataTable, FileDropzone, etc.). One file per component, plus a barrel `index.ts`. |
| `src/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` helper. Always use `cn()` for class composition. |
| `src/lib/tokens.ts` | **Single source of truth for cross-platform design tokens** (colors, spacing, radii, typography). Webapp `globals.css` `@theme` and `.dark` blocks mirror these. `@mma/mobile-ui` re-exports `lightColors` / `darkColors`. |

---

## Architectural Rules (Strictly Enforced)

1. **No domain logic.** Primitives never import from `@mma/contracts/*`, `@mma/client-common`, or any domain package. They are pure presentation.

2. **Variants use `class-variance-authority` (cva).** Never hand-roll variant prop → className mapping. See `webapp-ui-primitive` skill for the exact pattern.

3. **Wrap Radix for any interactive primitive that needs a11y / keyboard / focus management** — Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Label, Separator, Command. Never hand-roll. See `webapp-radix-primitive-wrap` skill.

4. **React 19 `ref` as a prop** — `forwardRef` is no longer needed. New components accept `ref` as a regular destructured prop (e.g. `function Button({ ref, ...props })`). Existing components that still use `React.forwardRef` work fine in React 19 but should be migrated incrementally. When writing **new** primitives, use the direct `ref` prop pattern — do NOT wrap in `forwardRef`. `displayName` is also unnecessary when using named function declarations/expressions.

5. **Tokens come from `tokens.ts`, NEVER hard-coded colors.** Use semantic Tailwind utilities (`bg-card`, `text-muted-foreground`, `border-border`) — never `bg-[#...]` or `text-blue-500`. Every new color must be added to BOTH the `@theme` and `.dark` blocks in `apps/webapp/src/app/globals.css` (Golden Rule #23j).

6. **Dark mode is supported via `.dark` CSS variable overrides.** Never branch on a `theme` prop — semantic utilities resolve automatically. See `webapp-dark-mode` skill.

7. **Every primitive must pass `@axe-core/playwright` `critical` + `serious` checks** when used on a scanned page (Golden Rule #23l).

8. **Barrel export.** Every new primitive must be re-exported from `packages/ui/src/index.ts`.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Adding a new primitive | `webapp-ui-primitive` |
| Wrapping a Radix primitive | `webapp-radix-primitive-wrap` |
| Adding/changing design tokens | `fe-design-tokens` |
| Sortable / selectable tables | `webapp-data-table` |
| Skeleton loaders | `webapp-skeleton-loading` |
| Form fields (FormField, FormItem, FormControl, FormMessage) | `webapp-form-with-validation` |
| Toast notifications | `webapp-toast-notifications` |
| File dropzone | `webapp-file-upload-ux` |
| Accessibility audit / fixing axe violations | `fe-accessibility-audit` |

**Always read the relevant skill BEFORE editing this package.**

---

## Cross-Platform Coordination

When adding a primitive that has a mobile counterpart, also add it to `packages/mobile-ui/src/components/` (see the `mobile-ui-primitive` skill) and use the `/new-ui-primitive` workflow prompt to coordinate both packages.
