---
name: fe-icon-set
description: Add a new icon to @old-st/ui or audit the existing icon set. Use this when a Figma frame references an icon not yet in the standard set, when changing the IIcon contract, or when investigating icon-color drift.
---

# Icon set — @old-st/ui/icons

## Source of truth

```
packages/ui/src/icons/
  icon.types.ts   # IIcon interface + iconAttrs() helper
  icons.tsx       # all icon components, alphabetical
  index.ts        # barrel
```

The barrel is re-exported from `@old-st/ui` so consumers import from the package root:

```tsx
import { ClockIcon, PlayIcon } from '@old-st/ui';
```

## The IIcon contract

Every icon component MUST accept these props:

```ts
interface IIcon {
  size?: number;          // px — sets width AND height
  color?: string;         // overrides currentColor; rarely needed
  className?: string;     // Tailwind utilities (preferred over `color`)
  'aria-label'?: string;  // when set, icon becomes accessible to AT
}
```

The shared `iconAttrs(props)` helper in `icon.types.ts` produces the standard SVG attributes:

- `width` / `height` from `size` (default 24)
- `stroke="currentColor"` so the icon inherits text color via Tailwind (`text-brand`, `text-destructive`)
- `fill="none"`, `viewBox="0 0 24 24"`, `strokeWidth={2}`, `strokeLinecap`, `strokeLinejoin`
- `aria-hidden="true"` when no `aria-label` is provided
- `role="img"` + `aria-label` when one is

## Why currentColor

Icons inherit text color. Tone is set by Tailwind utilities on the surrounding element \u2014 not by a per-icon `color` prop:

```tsx
//  ❌  <CheckIcon color="#7f56d9" />
//  ✅  <span className="text-brand"><CheckIcon /></span>
//  ✅  <CheckIcon className="text-success-text" />
```

This automatically respects dark mode via the `.dark` overrides in `globals.css`.

## Adding a new icon

1. Open `packages/ui/src/icons/icons.tsx`.
2. Add a new named function component accepting `ref` as a prop, using the `iconAttrs(props)` spread:
   ```tsx
   export function ChevronLeftIcon(props: IIcon & { ref?: React.Ref<SVGSVGElement> }) {
     const { ref, ...rest } = props;
     return (
       <svg ref={ref} {...iconAttrs(rest)} xmlns="http://www.w3.org/2000/svg">
         <path d="M15 18 9 12l6-6" />
       </svg>
     );
   }
   ```
3. Re-export from `packages/ui/src/icons/index.ts` (alphabetical).
4. If your project has scaffolded `/design-preview` (see `figma-import.md` Phase B.6.5), drop the icon into `apps/webapp/src/app/design-preview/icons/page.tsx` so it shows up in the visual reference. The template repo does not ship this surface — skip this step until the surface exists.
5. Verify: `pnpm exec tsc -p packages/ui/tsconfig.json --noEmit`.

## Sizing

Two equivalent ways \u2014 both supported:

```tsx
<ClockIcon size={20} />            // numeric prop
<ClockIcon className="h-5 w-5" />  // Tailwind utility
```

Prefer the Tailwind utility when the icon is part of a button/badge composition so the size matches the surrounding text scale.

## SVG conventions

- `viewBox="0 0 24 24"` always (matches the standard set)
- Stroke-based icons \u2014 no fill, `strokeWidth={2}` (handled by `iconAttrs`)
- Path data only \u2014 no embedded `<style>`, `<defs>`, `<use>`
- One path per logical shape; small inline `<line>`/`<circle>`/`<rect>` elements are OK
- No fixed colors in path attributes \u2014 stroke / fill come from the `iconAttrs` defaults

## Provenance during Figma imports

When an icon is added as part of a `/figma-import`, `/figma-page`, or `/figma-component` workflow, the icon MUST be traceable to a real Figma node — not chosen "because it would fit thematically" from `lucide-react` or any other icon set. Two acceptable provenances:

1. **From the imported Figma file.** The orchestrator records the icon in `apps/webapp/src/app/design-preview/figma-library-manifest.json` under `icons[]`:
   ```json
   {
     "icons": [
       { "name": "ChevronLeftIcon", "figmaNodeId": "237:1145", "svgSource": "figma" }
     ],
     "iconsTraceabilityEnforced": true
   }
   ```
   Every NEW icon symbol added to `packages/ui/src/icons/icons.tsx` during the workflow must have a matching entry here.
2. **Pre-Figma template default.** Icons that shipped with the template before any Figma import are recorded once in `manifest.templateAllowlist[]` when A.4.5 first runs (the orchestrator snapshots the current `icons.tsx` exports there). These continue to be allowed without a `figmaNodeId`.

The `figma-imported-icons-have-manifest-entry` structural lint check ([scripts/lint-standards.ts](scripts/lint-standards.ts)) enforces this whenever the manifest exists and `iconsTraceabilityEnforced === true`. A primitive that needs a new icon must add the icon to Figma first (or get explicit developer approval and add it to `templateAllowlist[]`) — the agent may NOT silently introduce one.

Anti-patterns the rule blocks:

- Adding `ClockIcon` to an empty-state "because empty states often have clocks".
- Adding a 12th icon to `icons.tsx` during a Figma import when only 11 are in the Figma file.
- Importing from `lucide-react` (or any third-party icon library) to satisfy a primitive's visual brief — Figma is the source of truth for the icon set.

## Forbidden

- **No third-party icon libraries pulled into webapp/mobile components.** Always wrap into our `IIcon` contract first.
- **No raw `<svg>` literals in domain components.** Add the icon to `@old-st/ui` and import it.
- **No per-icon color props in primitives.** Drive color via Tailwind on the parent.
- **No agent-invented icons during Figma workflows.** See § Provenance during Figma imports.
