---
description: "Convert exported SVG files into icon components in @mma/ui. USE WHEN the user exports SVG files from Figma (or any design tool) and wants them converted to React icon components. No Figma MCP tools required — just paste SVG markup or describe the files."
---

# SVG → Icon Components

Convert one or more exported SVG files into `@mma/ui` icon components. This is the fast path for icon additions — no Figma MCP connection needed.

**Do NOT write any files until Phase 2 (Confirm) is approved.**

---

## Phase 0 — Receive SVGs

Ask the user to paste their SVG content (or describe the filenames if uploading). Accept any of:

- Raw `<svg>...</svg>` markup (one or many, separated by a blank line or a comment)
- Filenames with SVG content pasted below each
- A **directory path** containing `.svg` files (e.g. `~/Downloads/icons/` or `packages/ui/src/icons/svg/`) — read file names from the directory for icon names and use the fast-path script with `--svg-dir`; skip Phase 1's manual normalisation (the script handles it)
- A description like "I have 10 icons: close, menu, arrow-left…" — in which case skip to Phase 1 with placeholder names and ask the user to paste SVGs one by one

For each SVG, attempt to infer the icon name from:
1. The filename (e.g. `arrow-left.svg` → `ArrowLeftIcon`)
2. A `<title>` element inside the SVG
3. An `id` or `data-name` attribute on the root `<svg>`

If none of the above yield a name, ask the user to provide names before continuing.

Confirm the list of icon names with the user before proceeding:

```
Detected N icons:
  • ArrowLeftIcon   (from arrow-left.svg)
  • MenuIcon        (from menu.svg)
  • CloseIcon       (from close.svg)
  …

Any names to change? Anything to skip?
```

---

## Phase 1 — Normalize

For each SVG, perform these transformations **in memory** (do not write files yet):

### Strip Figma / tool metadata
Remove from the root `<svg>` element:
- `id="..."`, `data-name="..."`, `class="..."` attributes
- Hardcoded `width="..."` and `height="..."` (will be replaced by `{size}` prop)
- `version="..."`, `xmlns:xlink="..."`, `xml:space="..."`
- Any `<title>`, `<desc>` child elements (a11y is handled via `aria-label` prop)
- Any `style="..."` attributes on child elements that set color (will be replaced)

### Normalize viewBox
- Must be `viewBox="0 0 24 24"`. If the source SVG uses a different viewport (e.g. `0 0 20 20` or `0 0 32 32`), note it and ask the user whether to rescale paths or accept as-is with a non-standard viewport.
- If the source has no `viewBox`, infer from the `width`/`height` attributes.

### Detect icon type
Classify each icon as **stroke**, **filled**, **two-color**, or **neutral**:

| Condition | Type |
|---|---|
| Root shapes use `stroke` attributes or `stroke="currentColor"` | **stroke** |
| Root shapes use a single hardcoded `fill` color (not `none`) | **filled** |
| Root shapes use **two distinct** hardcoded fill colors | **two-color** |
| Mixed (stroked + filled, one fill color) | **stroke** — treat filled shapes as accents; note for user review |
| No hardcoded colors — already uses `currentColor` / `none` | **neutral** — copy shapes as-is |

### Normalize colors

- **Stroke icons:** Remove any `stroke="black"`, `stroke="#000"`, `stroke="#1a1a1a"`, etc. from all child elements. The stroke will be applied via `iconAttrs(props)` at the `<svg>` level.
- **Filled icons:** Replace any hardcoded `fill` color with `fill="currentColor"` on the shape. Set `stroke="none"` on the shape if it also has a stroke.
- **Two-color icons:** Count occurrences of each distinct fill color across all shapes.
  - The **more frequent** color → `fill="currentColor"` (primary — driven by `color` prop or `text-*` class)
  - The **less frequent** color → `fill="var(--icon-color-2, currentColor)"` (secondary — driven by `color2` prop)
  - The `currentColor` fallback means the icon degrades to single-color when `color2` is omitted.
  - Usage: `<MyIcon color="#1a1a1a" color2="#7f56d9" />` or via Tailwind with `style={{ '--icon-color-2': '#7f56d9' }}`
  - The `svg-to-icons.py` script handles this automatically — no manual substitution needed.
- Remove `fill="none"` from child `<path>`/`<circle>` etc. elements (it will be set by `iconAttrs` on `<svg>`).
- Remove `fill-rule` and `clip-rule` only if they are at their SVG defaults (`nonzero` / `nonzero`). Preserve them if they affect rendering.

Show the user a brief diff summary:

```
ArrowLeftIcon — stroke icon, viewBox OK, stripped: id, width, height, stroke="#000"
MenuIcon      — stroke icon, viewBox OK, stripped: id, width, height, fill="none" on paths
CloseIcon     — stroke icon, viewBox OK, stripped: id, width, height, stroke="#1D2939"
```

Flag anything unusual (non-standard viewBox, mixed stroke/fill, `<defs>`, `<clipPath>`, `<use>`) and ask the user how to proceed before continuing.

---

## Phase 2 — Confirm

Present a preview of each component shell (collapsed — show only the `<svg>` opening tag + first child shape, not the full path data):

```tsx
// ArrowLeftIcon — stroke
export const ArrowLeftIcon = React.forwardRef<SVGSVGElement, IIcon>((props, ref) => (
  <svg ref={ref} {...iconAttrs(props)} xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
));

// MenuIcon — stroke
export const MenuIcon = React.forwardRef<SVGSVGElement, IIcon>((props, ref) => (
  <svg ref={ref} {...iconAttrs(props)} xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="12" x2="21" y2="12" /> {/* +2 more lines */}
  </svg>
));
```

Ask: **"Looks correct? Approve to write files."**

Wait for explicit approval before Phase 3.

---

## Phase 3 — Write files

### 3.1 — Check for name collisions

Read `packages/ui/src/icons/icons.tsx` and check whether any of the incoming icon names already exist. If a collision is found, surface it:

```
⚠️  CloseIcon already exists in icons.tsx. Overwrite, rename new one, or skip?
```

Wait for the user's answer before writing that specific icon.

### 3.2 — Write to `icons.tsx`

**Fast path — use the script when SVG files are already on disk in `packages/ui/src/icons/svg/`:**

```bash
# Add new SVG files to svg/, then run:
pnpm icons:add

# Preview without writing first:
pnpm icons:add --dry-run

# Point at a different source folder:
pnpm icons:add --svg-dir /path/to/export

# Use an external name-map JSON for a new batch without editing the script:
pnpm icons:add --map /tmp/my-names.json
```

The script applies all normalisation rules (stroke/filled detection, Figma mask unwrapping, camelCase attrs) automatically. After running, continue to step 3.3.

**Manual path — when SVGs are pasted inline (not on disk):**

Open `packages/ui/src/icons/icons.tsx`. For each approved icon, append the component in **alphabetical order** relative to existing icons.

**Stroke icon template:**
```tsx
export const {Name}Icon = React.forwardRef<SVGSVGElement, IIcon>((props, ref) => (
  <svg ref={ref} {...iconAttrs(props)} xmlns="http://www.w3.org/2000/svg">
    {/* normalized path data */}
  </svg>
));
{Name}Icon.displayName = '{Name}Icon';
```

**Filled icon template:**
```tsx
export const {Name}Icon = React.forwardRef<SVGSVGElement, IIcon>((props, ref) => (
  <svg ref={ref} {...iconAttrs(props)} xmlns="http://www.w3.org/2000/svg">
    <path d="..." fill="currentColor" stroke="none" />
  </svg>
));
{Name}Icon.displayName = '{Name}Icon';
```

### 3.3 — Update `icons/index.ts` barrel

Add every new icon name to the **existing `export { }` block** in `packages/ui/src/icons/index.ts`, maintaining strict alphabetical order. Do **not** add a separate `export { }` statement — there is exactly one named export block for icons.

```ts
export {
  AlertIcon,
  ArrowLeftIcon,   // ← new, inserted alphabetically
  CalendarIcon,
  CloseIcon,       // ← new
  // ...rest of existing icons...
} from './icons';
```

### 3.4 — Update / create `icons.stories.tsx`

Locate or create `packages/ui/src/icons/icons.stories.tsx`.

- If it **exists**: add each new icon to the `AllIcons` / gallery story and add an individual `Story` entry per icon.
- If it **does not exist**: create it with a `Gallery` story showing all icons (existing + new) in a grid.

Minimum story per new icon:
```tsx
export const {Name}IconStory: Story = {
  name: '{Name}Icon',
  render: () => <{Name}Icon size={24} />,
};
```

### 3.5 — Update / create `icons.spec.tsx`

Locate or create `packages/ui/src/icons/icons.spec.tsx`.

- If it **exists**: add a `describe` block (or `it` blocks) for each new icon inside the existing describe structure.
- If it **does not exist**: create it covering all icons (existing + new).

Minimum tests per new icon:
```tsx
describe('{Name}Icon', () => {
  it('renders without throwing', () => {
    render(<{Name}Icon />);
  });
  it('sets width and height from size prop', () => {
    const { container } = render(<{Name}Icon size={32} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });
  it('is aria-hidden by default', () => {
    const { container } = render(<{Name}Icon />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('renders role=img and aria-label when aria-label is provided', () => {
    const { container } = render(<{Name}Icon aria-label="Go back" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Go back');
  });
});
```

---

## Phase 4 — Verify

Run in order:

```bash
pnpm exec tsc -p packages/ui/tsconfig.json --noEmit
pnpm nx lint ui
pnpm nx test ui
```

## Phase 4.1 — Verification Mode

Ask the user which mode to run:

- **Fast**: icon-focused checks only
- **Strict**: full package checks

Default to **Fast** when the user explicitly says speed is preferred.

### Fast mode commands

```bash
pnpm exec tsc -p packages/ui/tsconfig.json --noEmit
pnpm nx test ui --testPathPattern=packages/ui/src/icons/icons.spec.tsx
```

### Strict mode commands

```bash
pnpm exec tsc -p packages/ui/tsconfig.json --noEmit
pnpm nx lint ui
pnpm nx test ui
```

If **Fast** mode passes, report completion and ask whether to run **Strict** mode as a follow-up.

Fix any errors before reporting completion. Common issues:

| Error | Fix |
|---|---|
| TS: `Cannot find name 'React'` | Ensure `import * as React from 'react';` is at the top of `icons.tsx` |
| TS: `iconAttrs` not found | Ensure `import { iconAttrs, type IIcon }` (not just `type IIcon`) |
| TSX: Unexpected token `<` | Missing `.tsx` extension or `jsx` not enabled in tsconfig |
| Test: `aria-hidden` assertion fails | Check `iconAttrs` returns `'aria-hidden': true` (string `'true'` matches attribute) |

---

## Phase 5 — Report

Report what was created / updated:

| File | Action | Icons added |
|---|---|---|
| `packages/ui/src/icons/icons.tsx` | updated | {list} |
| `packages/ui/src/icons/index.ts` | updated | {list} |
| `packages/ui/src/icons/icons.stories.tsx` | created \| updated | {list} |
| `packages/ui/src/icons/icons.spec.tsx` | created \| updated | {list} |

Suggested commit message:

```
feat(ui): add <N> icons from SVG export

Added: {IconA}, {IconB}, {IconC}, ...
Source: SVG export from Figma / {tool name}
Stories: icons.stories.tsx (updated)
```
