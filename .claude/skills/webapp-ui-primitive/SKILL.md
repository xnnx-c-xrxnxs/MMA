---
name: webapp-ui-primitive
description: Add a new shared UI component to the @mma/ui package. Use this when creating a new shadcn-style primitive (e.g. Dialog, Checkbox, Textarea, Tooltip) in packages/ui/src/components/. Covers the class-variance-authority (cva) variant pattern, cn() utility, ref-as-prop (React 19), barrel export, and Tailwind class conventions.
---

# Adding a UI Primitive to @mma/ui

`@mma/ui` is a **shadcn/ui-style** component library — Tailwind utilities + `class-variance-authority` (cva) + `cn()` + Radix where a11y matters. Every primitive is a thin, composable React component that accepts `ref` as a regular prop (React 19). There is **no SCSS, no styled-components, no Emotion** anywhere in the package — the `no-scss-files` structural lint check (`scripts/lint-standards.ts`) enforces this.

> **React 19 ref pattern:** `forwardRef` is no longer needed. New components accept `ref` as a destructured prop. Existing components that still use `React.forwardRef` work fine but should be migrated incrementally. When writing **new** primitives, always use the direct `ref` prop pattern. `displayName` is also unnecessary for named function declarations/expressions.

## Folder layout

Components live in **per-component subfolders inside category folders**:

```
packages/ui/src/components/
  form-controls/  button/   button.tsx + index.ts
                  input/    input.tsx + index.ts
                  label/    label.tsx + index.ts
                  select/   select.tsx + index.ts
                  form/     form.tsx + index.ts
                  file-dropzone/
  data-display/   badge/    avatar/   card/   table/   data-table/
                  list-row/ skeleton/ empty-state/
  feedback/       toast/    spinner/  tooltip/  dialog/
                  alert-dialog/ sheet/ popover/
  navigation/     tabs/     command/  dropdown-menu/  nav-item/
  layout/         separator/
```

Why subfolders: each primitive **must** colocate its `.tsx`, `index.ts`, `*.stories.tsx`, and `*.spec.tsx` so stories and tests live next to the implementation. The four-file layout is non-negotiable — enforced by the `ui-primitive-has-story-and-spec` lint check (see `add-structural-lint-check` skill).

```
button/
  button.tsx          ← implementation (cva + ref as prop)
  index.ts            ← `export * from './button';`
  button.stories.tsx  ← Storybook stories — see § Stories
  button.spec.tsx     ← Jest + React Testing Library — see § Tests
```

Canonical references:
- With variants: `packages/ui/src/components/form-controls/button/button.tsx` (+ stories + spec)
- Without variants: `packages/ui/src/components/form-controls/input/input.tsx`
- Compound: `packages/ui/src/components/data-display/card/card.tsx`, `packages/ui/src/components/data-display/table/table.tsx`
- Radix-wrapped: `packages/ui/src/components/feedback/dialog/dialog.tsx`
- Utility: `packages/ui/src/lib/utils.ts`
- Icons: `packages/ui/src/icons/` (see `fe-icon-set` skill)
- Barrel: `packages/ui/src/index.ts`

---

## Required Information — Ask First

1. **What component?** (e.g. Dialog, Checkbox, Textarea, Tooltip, Accordion)
2. **Does it need variants?** (e.g. size, variant, color — if yes, uses `cva`)
3. **Is it a compound component?** (e.g. Dialog has DialogTrigger, DialogContent, DialogTitle)
4. **Does it wrap a native HTML element?** (if yes, accept `ref` as a prop and pass it through)

---

## Component Patterns

The `@mma/ui` package follows the shadcn/ui pattern. There are three component shapes:

### Pattern A — Simple Component with cva Variants

Use when the component has visual variants (e.g. Badge, Button).

File: `packages/ui/src/components/{category}/{component}/{component}.tsx`

```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const {component}Variants = cva(
  // Base classes (always applied)
  'inline-flex items-center ...',
  {
    variants: {
      variant: {
        default: '...',
        secondary: '...',
        destructive: '...',
        outline: '...',
      },
      size: {
        default: '...',
        sm: '...',
        lg: '...',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface {Component}Props
  extends Omit<React.HTMLAttributes<HTML{Element}Element>, 'color' | 'size'>,
    VariantProps<typeof {component}Variants> {
  ref?: React.Ref<HTML{Element}Element>;
}

function {Component}({ className, variant, size, ref, ...props }: {Component}Props) {
  return (
    <{element}
      className={cn({component}Variants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
}

export { {Component}, {component}Variants };
```

**Rules:**
- Export both the component and the variants function (consumers may need `{component}Variants` for composition).
- Export the props interface for consumers that need to type-narrow.
- `className` is always the **last** argument to `cn()` so consumer overrides win.
- `defaultVariants` must always be defined.
- Accept `ref` as a regular prop and pass it to the underlying element (React 19 — no `forwardRef` needed).
- Use named function declarations so React DevTools shows readable names automatically (no `displayName` needed).

### Pattern B — Simple Component without Variants

Use for form elements and wrappers that just add styling (e.g. Input, Select).

```typescript
import * as React from 'react';
import { cn } from '../../../lib/utils';

interface {Component}Props extends React.{Element}HTMLAttributes<HTML{Element}Element> {
  ref?: React.Ref<HTML{Element}Element>;
}

function {Component}({ className, ref, ...props }: {Component}Props) {
  return (
    <{element}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { {Component} };
```

### Pattern C — Compound Component

Use for complex components with multiple related parts (e.g. Table, Card, Dialog).

```typescript
import * as React from 'react';
import { cn } from '../lib/utils';

function {Component}({ className, ref, ...props }: React.HTMLAttributes<HTML{Element}Element> & { ref?: React.Ref<HTML{Element}Element> }) {
  return <{element} ref={ref} className={cn('...', className)} {...props} />;
}

function {Component}Header({ className, ref, ...props }: React.HTMLAttributes<HTML{Element}Element> & { ref?: React.Ref<HTML{Element}Element> }) {
  return <{element} ref={ref} className={cn('...', className)} {...props} />;
}

// ... additional sub-components

export { {Component}, {Component}Header, {Component}Body, ... };
```

**Rules:**
- Each sub-component is a named function that accepts `ref` as a prop.
- All sub-components are exported individually (not nested).
- No `children` type annotation needed — it's included in `React.HTMLAttributes`.

---

## Tailwind Class Conventions

Follow these patterns for consistency with the existing components:

| Purpose | Classes |
|---|---|
| Focus ring | `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` |
| Disabled state | `disabled:pointer-events-none disabled:opacity-50` |
| Transitions | `transition-colors` (for hover/focus) |
| Rounded corners | `rounded-md` (standard), `rounded-lg` (cards) |
| Borders | `border border-input` |
| Shadows | `shadow-sm` (subtle), `shadow` (elevated) |
| Spacing | Use Tailwind spacing scale (`px-3 py-1`, `p-6`, `gap-2`) |
| Typography | `text-sm` (default body), `text-xs` (badges, captions) |
| Muted text | `text-muted-foreground` |
| Destructive | `text-destructive`, `bg-destructive text-destructive-foreground` |

**Color tokens:** Always use semantic tokens (`primary`, `secondary`, `muted`, `accent`, `destructive`, `brand`, `brand-subtle`) — never raw colors like `bg-red-500` and never inline hex literals like `bg-[#7f56d9]`. Numeric scale steps (`bg-brand-100`, `text-gray-700`) are allowed when a specific shade is the design intent. Status variants use the dedicated semantic tokens: `bg-success-bg text-success-text`, `bg-warning-bg text-warning-text`, `bg-danger-bg text-danger-text`. See the `fe-design-tokens` skill for the full list.

## Icons

Icons are first-class. They live in `packages/ui/src/icons/` and follow the `IIcon` contract (size, color, className). All icons use `viewBox="0 0 24 24"` and `currentColor` so they inherit text color via Tailwind utilities (`text-brand`, `text-destructive`). When a primitive needs an icon slot, accept a `React.ReactNode` prop and let the consumer pass any icon — do NOT hard-code icon imports inside the primitive. Adding a new icon: see the `fe-icon-set` skill.

## Forbidden

- **No SCSS / Sass / styled-components / Emotion / per-component CSS Module** anywhere in `packages/ui/`. Enforced by the `no-scss-files` lint check. Styling is exclusively Tailwind v4 utilities + `cva()` against the tokens in `packages/ui/src/lib/tokens.ts`. SCSS is rejected because (a) it would create a parallel styling system, (b) it bypasses the `pnpm tokens:gen` dark-mode pipeline, and (c) it is invisible to Tailwind v4's `@source` scanner.
- **No inline hex literals** (`bg-[#...]`). Always go through the semantic token or scale step.
- **No raw HTML interactive elements without accepting a `ref` prop.**
- **No hand-rolled focus management** — wrap Radix instead (see `webapp-radix-primitive-wrap`).
- **No primitive without `*.stories.tsx` AND `*.spec.tsx` siblings.** A primitive is incomplete until both exist.
- **`UI_PRIMITIVE_BACKFILL_ALLOWLIST` in [scripts/lint-standards.ts](scripts/lint-standards.ts) MUST stay empty.** It exists only to keep the option open for a future bulk import; never add an entry "to unblock CI" — ship the missing `.stories.tsx` / `.spec.tsx` instead. If the allowlist is non-empty in `develop`, file a follow-up PR to backfill the entries and remove them.

---

## Stories — `{component}.stories.tsx`

Every primitive ships a Storybook story file. Stories are the **canonical visual reference** — replace the legacy ad-hoc `/design-preview` page over time. Run `pnpm nx run ui:storybook` to boot the sandbox at http://localhost:4400.

Minimum stories to ship:

1. **`Default`** — bare render with the default variant.
2. **One story per `variant` value** (or one combined `Variants` story showing all variants side-by-side).
3. **One `Sizes` story** if the primitive has a `size` variant.
4. **One state story per non-default state** (`Loading`, `Disabled`, `Error`) when applicable.

Template (mirrors `packages/ui/src/components/form-controls/button/button.stories.tsx`):

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { {Component} } from './{component}';

const meta: Meta<typeof {Component}> = {
  title: '{Category Pretty Name}/{Component}',  // e.g. 'Form Controls/Button'
  component: {Component},
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'brand', 'destructive'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
  },
  args: { children: 'Label' },
};

export default meta;
type Story = StoryObj<typeof {Component}>;

export const Default: Story = {};
export const Brand: Story = { args: { variant: 'brand' } };
// ...
```

**Story rules:**

- Title = `'{Category Pretty Name}/{Component}'` so the sidebar groups by folder. Pretty names: `Form Controls`, `Data Display`, `Feedback`, `Navigation`, `Layout`.
- Always set `tags: ['autodocs']` so Storybook generates a Docs page from props.
- Use `argTypes` only for props that benefit from a control widget; let Storybook infer the rest.
- Theme switching (light/dark) is handled globally by `@storybook/addon-themes` — do NOT add per-story theme decorators. The toolbar toggles `class="dark"` on `<html>`, exactly like `<ThemeToggle>` does in production.
- `@storybook/addon-a11y` runs axe on every story — fix critical/serious violations before merging.

### Stories contract (enforced by lint)

When the primitive uses `cva()` for variants, the stories file MUST honour three rules so the Storybook Controls addon is functional — not decorative:

1. **Every `cva` variant key appears as an `argTypes` entry.** If `buttonVariants` declares `variants: { variant: {...}, size: {...}, tone: {...} }`, the stories file must include `argTypes: { variant: {...}, size: {...}, tone: {...} }` with matching `options`. Missing keys mean the Controls panel cannot toggle them.
2. **Non-default variant values are set via `args:` on a named story — never via `className` strings.** The Controls panel only reflects what's in `args`. Setting `<Button className="variant-brand">` (wrong) leaves the Variant dropdown stuck on `default` even though the rendered element shows the brand styling. Always: `export const Brand: Story = { args: { variant: 'brand' } };`.
3. **One named export per discrete variant value** (or one combined `Variants` story that uses `args` for each row). Either is acceptable; the rule is that the addon panel must be able to flip every variant to every option without editing code.

The `cva-variants-have-storybook-argtypes` structural lint check ([scripts/lint-standards.ts](scripts/lint-standards.ts)) parses every `cva(...)` call in `{name}.tsx`, extracts the variant keys, and asserts each key is mentioned in `{name}.stories.tsx`. Failures look like:

```
[cva-variants-have-storybook-argtypes] packages/ui/src/components/data-display/badge/badge.stories.tsx — cva variant key 'tone' is missing from argTypes. The Controls panel cannot toggle it. Add `tone: { control: 'select', options: [...] }`.
```

Primitives without `cva` (Pattern B) are exempt from the contract — the autodocs panel infers controls from the props interface.

---

## Tests — `{component}.spec.tsx`

Every primitive ships a Jest + React Testing Library spec file. Run `pnpm nx test ui` for the full suite. Coverage target: **70%** (branches, functions, lines, statements). Stories and `index.ts` are excluded from coverage collection (see `packages/ui/jest.config.ts`).

Minimum tests to ship:

1. **Renders children / label** correctly.
2. **Applies the variant + size classes via `cva`** (assert key Tailwind classes appear on the rendered element).
3. **Forwards ref** to the underlying element via the `ref` prop.
4. **Honours every accessibility-critical prop** (`aria-busy`, `aria-label`, `disabled`, `role`).
5. **One test per non-trivial state** (loading, disabled, error).

Template (mirrors `packages/ui/src/components/form-controls/button/button.spec.tsx`):

```typescript
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { {Component} } from './{component}';

describe('{Component}', () => {
  it('renders children', () => {
    render(<{Component}>Save</{Component}>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies the variant class via cva', () => {
    render(<{Component} variant="brand">B</{Component}>);
    expect(screen.getByRole('button', { name: 'B' }).className).toContain('bg-brand');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTML{Element}Element>();
    render(<{Component} ref={ref}>R</{Component}>);
    expect(ref.current).toBeInstanceOf(HTML{Element}Element);
  });
});
```

**Test rules:**

- Use `getByRole` first, `getByLabelText` second, `getByTestId` only as a last resort.
- Assert on Tailwind class fragments via `.className.toContain('h-10')` rather than full strings.
- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute`) are available globally via `packages/ui/src/test-setup.ts`.
- CSS is stubbed in tests (see `packages/ui/src/__mocks__/style-mock.js`) — never assert on computed styles.

---

## Barrel Export

File: `packages/ui/src/index.ts`

After creating the component, add it to the barrel export:

```typescript
// in packages/ui/src/index.ts under the matching `// {category}` block
export { {Component}, {component}Variants, type {Component}Props } from './components/{category}/{component}';
```

**Rules:**
- Group under the existing category comment block (`// form-controls`, `// data-display`, `// feedback`, `// navigation`, `// layout`).
- Export the component, variants function (if Pattern A), and props interface.
- Compound components export all sub-components.
- Maintain alphabetical order within each category block.
- The component's own `index.ts` re-exports from the `.tsx` (`export * from './{component}';`) so the barrel only references the folder path, never the inner file.

---

## The `cn()` Utility

```typescript
// packages/ui/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`cn()` merges class lists with Tailwind conflict resolution. Always use it for:
- Combining base classes with consumer `className` overrides.
- Combining variant classes with base classes inside `cva`.
- Conditional class application: `cn('base', condition && 'conditional')`.

---

## Dependencies

The `@mma/ui` package uses these peer/direct dependencies:

| Package | Purpose |
|---|---|
| `class-variance-authority` | `cva()` for type-safe variant definitions |
| `clsx` | Class list merging (used inside `cn()`) |
| `tailwind-merge` | Resolves Tailwind class conflicts (used inside `cn()`) |
| `react` | Peer dependency |

If adding a component that needs a new dependency (e.g. `@radix-ui/react-dialog` for an accessible Dialog), install it in the `packages/ui` workspace:

```bash
pnpm add @radix-ui/react-dialog --filter @mma/ui
```

---

## Quick Reference: Which Files Are Affected

| Change type | Files |
|---|---|
| New component (simple) | `packages/ui/src/components/{category}/{name}/{name}.tsx` + `index.ts` + `{name}.stories.tsx` + `{name}.spec.tsx`, plus barrel re-export in `packages/ui/src/index.ts` |
| New component (compound) | Same four files — all sub-components in the one `.tsx`, all sub-components stored in one `.stories.tsx`, all sub-components covered by one `.spec.tsx` |
| New variant on existing component | `{name}.tsx` + add a story for the new variant + add a `.spec.tsx` assertion for the variant class |
| New utility | `packages/ui/src/lib/` + `packages/ui/src/index.ts` (no story / no per-utility spec required — cover via consuming primitive's spec) |

---

## Common Mistakes to Avoid

- **Forgetting `ref` prop** — components that wrap HTML elements must accept and forward `ref` for composition with form libraries and focus management.
- **Using `React.forwardRef` in new code** — React 19 supports `ref` as a regular prop. Use named function declarations instead; `displayName` is then unnecessary.
- **Using raw colors instead of tokens** — `bg-red-500` breaks theming. Use `bg-destructive` or semantic tokens.
- **Putting `className` before variant classes in `cn()`** — consumer `className` must be last so it can override defaults.
- **Creating domain-specific components in `@mma/ui`** — this package is domain-agnostic. Domain components (e.g. `UsersTable`) go in `apps/webapp/src/components/{domain}/`.
- **Not exporting from the barrel** — components not in `index.ts` won't be importable via `@mma/ui`.
- **Shipping a primitive without a `.stories.tsx`** — the lint check will fail and reviewers will block the PR. Stories are the visual contract.
- **Shipping a primitive without a `.spec.tsx`** — same lint check + drops package coverage below the 70% threshold.
- **Adding a `.scss` / `.sass` / `.module.css` file** — explicitly rejected by template policy and the `no-scss-files` lint check. Use Tailwind utilities + tokens.
