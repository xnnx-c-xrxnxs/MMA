---
description: Add a new shared UI primitive in parallel across @old-st/ui (web) and @old-st/mobile-ui (mobile).
---

# Workflow: new shared UI primitive (web + mobile)

Use when introducing a new design-system primitive that must exist on both platforms with matching semantics — Avatar, Skeleton, Switch, Slider, Progress, etc.

This workflow composes the [webapp-ui-primitive](../../skills/webapp-ui-primitive/SKILL.md), [webapp-radix-primitive-wrap](../../skills/webapp-radix-primitive-wrap/SKILL.md) (when relevant), [mobile-ui-primitive](../../skills/mobile-ui-primitive/SKILL.md), and [fe-design-tokens](../../skills/fe-design-tokens/SKILL.md) skills.

## Phase 0 — Scaffold with generator

**Always run the generator first** — it creates the 4-file skeleton and wires the barrel export automatically.

```bash
pnpm nx g @old-st/nx-plugin:ui-primitive
# Interactive prompts: name, category, pattern
# Or non-interactively:
pnpm nx g @old-st/nx-plugin:ui-primitive --name=Switch --category=form-controls --pattern=simple-variants
```

Pattern guide:
- `simple-variants` — `cva` + `forwardRef` with visual variants (e.g. Button, Badge, Skeleton, Avatar)
- `simple-no-variants` — `forwardRef` + `cn` only, no variants (e.g. Input, Label, Separator)
- `compound` — multiple named sub-components (e.g. Card, Table, Dialog stub)

The generator produces:
```
packages/ui/src/components/{category}/{name}/
  {name}.tsx          ← component with TODO Tailwind classes
  index.ts            ← re-export
  {name}.stories.tsx  ← Storybook story
  {name}.spec.tsx     ← Jest + RTL spec
```
And adds the export to `packages/ui/src/index.ts`.

After running the generator, open the `.tsx` file and fill in the Tailwind classes before continuing.

## Phase 0.5 — Interview

Before filling in Tailwind classes and before adding Radix, answer:

1. **Name & shape**: what is the primitive? (e.g. `Switch`, `Progress`, `Avatar`)
2. **Variants**: visual variants? (`size: sm | md | lg`, `variant: default | accent`)
3. **State**: controlled, uncontrolled, both?
4. **A11y model**: which ARIA role + keyboard model? (Radix primitive needed?)
5. **Mobile parity**: is the equivalent native primitive in `react-native` or do we need a custom build?
6. **New tokens needed?** — if the primitive introduces a color/radius/spacing not already in `tokens.ts`, plan the token first

If a Radix primitive matches the a11y requirement, the web side uses it. The mobile side hand-rolls the same semantic shape using React Native components.

## Phase 1 — Plan the API

Define the prop surface ONCE. Both platforms ship the same prop names (with platform-specific types: `className` on web, `style` on mobile). Document this in a short comment block before writing code.

Example:

```ts
// Switch
// Props (both platforms):
//   checked: boolean
//   onCheckedChange: (next: boolean) => void
//   disabled?: boolean
//   aria-label / accessibilityLabel: string  // platform-specific name, same role
```

## Phase 2 — Add tokens (if needed)

If new tokens are required, follow [fe-design-tokens](../../skills/fe-design-tokens/SKILL.md) FIRST:

1. Add to `lightColors` + `darkColors` in `packages/ui/src/lib/tokens.ts`
2. Mirror in `globals.css` (`@theme` and `.dark`)
3. Confirm mobile picks them up via the re-export

## Phase 3 — Build web primitive

Load [webapp-ui-primitive](../../skills/webapp-ui-primitive/SKILL.md) (or [webapp-radix-primitive-wrap](../../skills/webapp-radix-primitive-wrap/SKILL.md) if Radix-based). Then:

1. Create `packages/ui/src/components/{category}/{primitive}/{primitive}.tsx` + `index.ts`
2. Create `packages/ui/src/components/{category}/{primitive}/{primitive}.stories.tsx` (canonical visual reference — see the skill § Stories)
3. Create `packages/ui/src/components/{category}/{primitive}/{primitive}.spec.tsx` (Jest + RTL — see the skill § Tests)
4. Use `cva` for variants
5. Wire the Radix primitive (if applicable)
6. Export from `packages/ui/src/index.ts`

```powershell
pnpm nx test ui --skip-nx-cache
pnpm nx run ui:build-storybook
pnpm nx build webapp
```

## Phase 4 — Build mobile primitive

Load [mobile-ui-primitive](../../skills/mobile-ui-primitive/SKILL.md). Then:

1. Create `packages/mobile-ui/src/components/{primitive}.tsx`
2. Use the variant-record pattern (object literal mapping variant → `StyleSheet`)
3. Use theme tokens from `@old-st/mobile-ui` (which re-exports `@old-st/ui` tokens)
4. Export from `packages/mobile-ui/src/index.ts`
5. Add a React Native Testing Library test if the primitive has interaction logic

```bash
pnpm nx test mobile
```

## Phase 5 — Visual + accessibility check

- Web: open Storybook (`pnpm nx run ui:storybook`, http://localhost:4400), navigate to the new story, flip the theme toolbar to verify dark mode. The `@storybook/addon-a11y` panel auto-runs axe on the rendered story — fix critical/serious violations.
- Mobile: render in a screen; verify on both iOS and Android simulators if interactive.
- If the primitive will appear on a webapp page tracked by `axe-scan.spec.ts`, also run the page-level a11y scan once it's wired in.

## Phase 6 — Document & commit

1. Update the relevant component-listing skill files if needed.
2. Final verification:
   ```bash
   pnpm nx run-many -t test -p webapp mobile client-common
   pnpm nx build webapp
   pnpm -w run lint:standards
   ```
3. Pre-merge subagent fan-out (read-only, in parallel):
   - `Agent(subagent_type="dependency-auditor", prompt="scope=packages/ui/**,packages/mobile-ui/**,apps/webapp/**,apps/mobile/**")`
   - `Agent(subagent_type="golden-rule-validator", prompt="scope=ui-primitive:{name}, ruleSet=frontend")` — enforces the design-token + dark-mode + StyleSheet rules.
4. Commit message: `feat(ui): add {primitive} primitive (web + mobile)`.

## Rules

1. **Web and mobile primitives MUST share semantic prop names** (with platform-appropriate TypeScript types).
2. **Both platforms support dark mode from day one** — never ship a primitive that only handles light theme.
3. **Mobile MUST use `StyleSheet.create()`** (Golden Rule 34) — no inline objects except for one-off dynamic values.
4. **Web MUST use semantic Tailwind utilities** (`bg-card`, `text-muted-foreground`) — never raw colors.

## Out of scope

- Domain-specific components (those go in `apps/webapp/src/components/{domain}` or `apps/mobile/src/components/{domain}`)
- Primitives needed by only one platform (skip the other phase but still update the relevant skill file)
