---
name: webapp-radix-primitive-wrap
description: Wrap a Radix UI primitive (Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Separator, Label, Command/cmdk) into the @old-st/ui package following the shadcn pattern. Use this when adding a new accessible interactive primitive that needs keyboard/focus management.
---

# Radix Primitive Wrap

The `@old-st/ui` package wraps Radix primitives following the shadcn/ui pattern: each compound is split into individually-exported subcomponents that accept `ref` as a regular prop (React 19), with Tailwind variants applied via `cn()`.

This skill is a more specialized partner to `webapp-ui-primitive`. Use this when the new primitive **wraps a Radix package**; use `webapp-ui-primitive` when it doesn't (e.g. `<Skeleton>`, `<Input>`, `<Badge>`).

Already wrapped:
- `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` (`@radix-ui/react-dialog`)
- `dropdown-menu.tsx` (`@radix-ui/react-dropdown-menu`)
- `tooltip.tsx` (`@radix-ui/react-tooltip`)
- `popover.tsx` (`@radix-ui/react-popover`)
- `tabs.tsx` (`@radix-ui/react-tabs`)
- `label.tsx` (`@radix-ui/react-label`)
- `separator.tsx` (`@radix-ui/react-separator`)
- `command.tsx` (`cmdk`)

---

## Required Information — Ask First

1. **Which Radix package?** (must be installed at the workspace root — see `package.json` deps)
2. **What sub-components are exposed?** (Look at the Radix primitive's docs — wrap each one.)
3. **Does any sub-component need a built-in icon?** (e.g. `<DialogContent>` has a built-in close `<X>` from `lucide-react`.)

---

## Required Boilerplate

Each Radix wrapper component file follows this template:

```tsx
'use client';

import * as React from 'react';
import * as {Primitive} from '@radix-ui/react-{name}';
import { cn } from '../../../lib/utils';

const {Component} = {Primitive}.Root;
const {Component}Trigger = {Primitive}.Trigger;
// ... re-export portals, groups, etc. that don't need styling

function {Component}Content({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof {Primitive}.Content> & {
  ref?: React.Ref<React.ElementRef<typeof {Primitive}.Content>>;
}) {
  return (
    <{Primitive}.Content
      ref={ref}
      className={cn(
        'z-50 ... data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    />
  );
}

export {
  {Component},
  {Component}Trigger,
  {Component}Content,
  // ...
};
```

---

## Rules

1. **Always include `'use client'`.** Radix primitives use React state and refs — they cannot run in Server Components.
2. **Accept `ref` as a regular prop** (React 19) for any component that wraps a Radix sub-component. Use `React.ElementRef<typeof X>` and `React.ComponentPropsWithoutRef<typeof X>` for types. No `forwardRef` or `displayName` needed with named function declarations.
3. **Use named function declarations** for readable React DevTools names (replaces the old `displayName = ...` pattern).
4. **Animations come from Tailwind data-attributes**, not custom CSS:
   - `data-[state=open]:animate-in data-[state=closed]:animate-out`
   - `data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`
   - `data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`
   These work because of `tailwindcss-animate` (built into Tailwind v4 setup).
5. **Re-export pure pass-through pieces directly** (Root, Trigger, Portal, Close) — only wrap the ones that need className styling.
6. **The `className` prop is always merged via `cn()` with the consumer's value last** so consumers can override.
7. **Compound parts are exported individually**, never namespace-grouped. So `DialogContent` not `Dialog.Content`.
8. **`z-50`** is the standard z-index for Radix portals (above the layout, below toasts which are `z-[100]`).
9. **Add the new component(s) to `packages/ui/src/index.ts`** in alphabetical order with the existing barrel exports.

---

## When to Use cva Variants

Use `class-variance-authority` (cva) when the Radix wrapper has visual variants:
- `<Sheet>` has `side: 'top' | 'bottom' | 'left' | 'right'` → uses `cva`.
- `<AlertDialog>` has no variants → no cva.

See `packages/ui/src/components/feedback/sheet/sheet.tsx` for the cva variant pattern with Radix.

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| `Cannot read properties of undefined (reading 'displayName')` at compile | You're not on `'use client'`. Add the directive. |
| Animations flicker | You're missing the `data-[state=closed]:animate-out` half. Both directions must be specified. |
| Portal renders behind dialog | Increase z-index to `z-50` or higher. |
| Tooltip flashes briefly on mount | Wrap the app in `<TooltipProvider>` once at the layout level. |
| Multiple dropdowns overlap | Each must have its own `<DropdownMenu>` parent — they don't share trigger state. |

---

## Tests

Radix wrappers are interaction-heavy. Add component tests for:
- Open/close on trigger click.
- Escape key closes the dialog.
- Outside-click closes the dropdown.
- Keyboard navigation moves focus through menu items.

See `write-webapp-tests` skill for the `@testing-library/user-event` setup.
