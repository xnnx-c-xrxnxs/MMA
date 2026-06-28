---
description: 'Analyze any source repository and generate or update Storybook stories (.stories.tsx) for its UI components. Derives the full variant matrix, sub-component composition API, and domain-relevant fixture content from source code analysis — no existing stories required. Run before /migrate-extract to give the source-component-inventory agent the richest possible input. Also useful standalone to bootstrap Storybook coverage for any React component library.'
---

# Generate Source Stories

You are generating comprehensive Storybook stories for every UI component in a source repository. You will derive everything needed — variant matrices, composition patterns, fixture data, edge states — directly from the source code. No existing stories are required, but if they exist you will enrich rather than replace them.

**This prompt writes `.stories.tsx` files into the source repository.** It does NOT touch the target template, does NOT generate spec YAML, and does NOT build production code.

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for all answers before proceeding.

### Required Information

1. **Source repository path?** (absolute path, e.g. `d:\old-st-flow`)
2. **Components folder?** Relative path to the UI primitive components folder (e.g. `src/components/ui`). If unsure, answer `auto-detect`.
3. **Storybook version?** (`7` or `8`). If unsure, answer `auto-detect` (will be read from `package.json`).
4. **Overwrite existing stories?** (`skip` = keep existing story files untouched; `enrich` = add missing story exports to existing files; `regenerate` = overwrite all). Default `skip`.
5. **Scope?** (`all` = all components; or a comma-separated list of component names, e.g. `Button, Card, Badge`). Default `all`.
6. **Include feature composites?** Should stories be generated for domain-level composite components (e.g. `src/components/` files outside the primitives folder)? (`yes` / `no`). Default `no`.

---

## Phase A — PLAN (read-only)

**Do not write any files in this phase.**

### A.1 — Detect Storybook setup

Read `package.json` in the source root. Find:

- `@storybook/react` or `@storybook/react-vite` version → confirm Storybook is installed
- Storybook config folder (`.storybook/`)
- Whether `@storybook/addon-essentials` or `@storybook/addon-docs` is present (required for `autodocs`)
- Story format: `{ component, Meta, StoryObj }` pattern (Storybook 7+) vs legacy CSF2

If Storybook is not installed, report: **"Storybook is not installed in this repository. Run `pnpm dlx storybook@latest init` first, then re-run this prompt."** Stop.

### A.2 — Enumerate components

Scan the components folder. For each `.tsx` file that is NOT a story file:

- Record: `componentName`, `filePath`, `hasExistingStory` (boolean)
- If scope = a named list, filter to only those components

### A.3 — Detect global conventions

Read `.storybook/main.ts` (or `main.js`). Note:

- `stories` glob pattern (to confirm target path matches)
- Any registered addons relevant to story generation

Read one or two existing story files (if present) to extract the exact import style, parameter conventions, and `satisfies Meta<typeof X>` vs `as Meta<typeof X>` preference used in this repo. **Use the project's own conventions exactly** — do not impose new ones.

If no existing stories are present, use the Storybook 8 CSF3 conventions shown in the story template below.

### A.4 — Produce build manifest

Output a table:

| Component | Path                         | Has story | Action                | Estimated stories                     |
| --------- | ---------------------------- | --------- | --------------------- | ------------------------------------- |
| Badge     | src/components/ui/badge.tsx  | ✗         | generate              | Default + Variants + States           |
| Button    | src/components/ui/button.tsx | ✗         | generate              | Default + Variants + States + States2 |
| Card      | src/components/ui/card.tsx   | ✓         | skip (overwrite=skip) | —                                     |

Show totals: `N components to generate, M to skip, K to enrich`.

**Stop here.** Present the plan and ask: `"Approve to proceed with story generation, or reply with any component names to exclude."`

---

## Phase B — EXECUTE

For each component in the build manifest with action `generate` or `enrich`, follow the **Per-Component Analysis Protocol** below, then write the story file.

Process components in dependency order: primitives with no imports from the same folder first, then composites that import from those primitives.

---

## Per-Component Analysis Protocol

For each component file, execute these steps in order:

### Step 1 — Read the source file

Read the full component `.tsx` source file. Extract:

**A. Export surface**

- Default export (the primary component, e.g. `Button`)
- Named exports (sub-components, e.g. `Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription`)
- Re-exports (e.g. `export { Root as Dialog }`)

**B. Variant matrix (cva-based)**
Check for `cva(...)` calls. If present, extract:

- Every `variants` key (e.g. `variant`, `size`)
- Every option for each key (e.g. `variant: { default, secondary, destructive, outline }`)
- `defaultVariants` (which options are selected by default)
- The TypeScript prop interface name (e.g. `ButtonProps = VariantProps<typeof buttonVariants>`)

If there is NO `cva()`, check for:

- TypeScript union props: `variant?: 'primary' | 'secondary' | 'ghost'`
- Object maps: `const variantClasses = { primary: '...', secondary: '...' }`
- Conditional `cn()` calls: `className={cn(base, variant === 'destructive' && 'text-red-500')}`

**C. Prop inventory**
Read the TypeScript interface or props type. Note:

- All boolean props (e.g. `disabled`, `checked`, `loading`, `asChild`)
- All required props (these must appear in every story)
- Props that accept React.ReactNode (identify "children slot" — needs fixture content)
- Props that accept callbacks (e.g. `onSelect`, `onChange`) — need stub handlers in stories

**D. External library detection**
Scan imports. Note any third-party library that contributes to the component's API surface:

- `react-day-picker` → Calendar modes (`single`, `range`, `multiple`)
- `recharts` / `@tremor/react` → Chart config shape
- `react-hook-form` → Form requires `useForm()` wrapper in story
- `@radix-ui/*` → Compound Radix primitives (controlled + uncontrolled state patterns)
- `embla-carousel-react` → Carousel auto-play/loop options
- `cmdk` → Command palette `open` state

For each detected library, read the component file's JSDoc or prop type to understand which options to showcase.

---

### Step 2 — Scan feature usage (domain fixture content)

Run a targeted search across the source repo's `src/` folder (excluding `components/ui/`) to find **real usage of this component** in feature pages/views.

Search for: `<{ComponentName}` and `from './components/ui/{filename}'` and `from '@/components/ui/{filename}'`

For each usage found, extract:

- The specific props passed (variant overrides, size, className overrides, children content)
- The fixture content (real label text, placeholder text, column headers, option lists)
- Any composition pattern (e.g. Card used with `CardHeader > CardTitle + CardDescription`)

**Use this domain vocabulary in the story fixture content.** For example: if the app uses `<Badge>In Progress</Badge>` in ticket views, the story's Variants render should include `<Badge>In Progress</Badge>`, not `<Badge>Label</Badge>`.

If no feature usage is found, use plausible domain-generic content (see Fixture Vocabulary below).

---

### Step 3 — Determine story set

Based on the analysis, decide which stories to generate:

| Story name     | When to generate                                                                | What it shows                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Default`      | Always                                                                          | The component with sensible defaults. If `args` are set at meta level, `export const Default: Story = {}` is enough. Otherwise use a minimal `render`. |
| `Variants`     | When 2+ variant options exist (from cva, union prop, or feature usage patterns) | A flex/grid row showing all variant values side-by-side                                                                                                |
| `States`       | When disabled/checked/loading/icon-only states exist                            | Size variants OR interactive state combinations (disabled, with icon, without icon)                                                                    |
| `States2`      | When a second orthogonal state dimension exists                                 | (e.g. Button has `States` = sizes and `States2` = disabled)                                                                                            |
| `States3`      | When a third orthogonal state dimension exists                                  | (e.g. Button has `States3` = with leading icon)                                                                                                        |
| `{DomainName}` | When a composition requires real domain fixture content                         | (e.g. Card's `Default` story shows a real project card, not "Title / Description")                                                                     |

**Maximum 5 stories per component.** Prefer fewer, richer stories over many thin ones.

---

### Step 4 — Generate the story file

Use the template below. Replace all `{PLACEHOLDERS}`.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
// Import any icons used in feature stories (from lucide-react, heroicons, etc.)
// Import any required hook (useState, useForm) at the top

import { {ComponentName}{, SubComponent1, SubComponent2} } from "./{filename}";

const meta = {
  title: "UI/{ComponentName}",
  component: {ComponentName},
  tags: ["autodocs"],
  parameters: {
    layout: "{centered | padded | fullscreen}",
    // Use "centered" for small, self-contained components (Badge, Button, Avatar)
    // Use "padded" for medium components that need breathing room (Card, Table, Form, Select)
    // Use "fullscreen" for layout components that occupy the viewport (Sidebar, Sheet, Dialog)
  },
  // Include args + argTypes ONLY if the component has a cva() variant prop
  // args: {
  //   children: "{default label}",
  //   variant: "{defaultVariant}",
  // },
  // argTypes: {
  //   variant: {
  //     control: "select",
  //     options: ["{opt1}", "{opt2}", ...],
  //   },
  // },
} satisfies Meta<typeof {ComponentName}>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Default story ---
// If the meta has args that cover the default rendering:
export const Default: Story = {};
// If the component needs a render function:
// export const Default: Story = {
//   render: () => (
//     <{ComponentName} {props}>
//       {fixture content from feature usage}
//     </{ComponentName}>
//   ),
// };

// --- Variants story (only if variant matrix exists) ---
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {/* One instance per variant value, labeled with domain-relevant content */}
    </div>
  ),
};

// --- States story (sizes, disabled, icon, etc.) ---
export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {/* One instance per state or size */}
    </div>
  ),
};
```

**Fixture vocabulary guidelines** (apply when no feature usage found):

- For a ticket/project management app: use `"Backlog"`, `"In Progress"`, `"Review"`, `"Done"` as status labels; `"Alex Morgan"`, `"Riley Chen"`, `"Sam Patel"` as person names; ticket IDs like `"PROJ-1042"`; project names like `"Payments API Migration"`, `"Auth Redesign Q3"`.
- For e-commerce: use `"Draft"`, `"Active"`, `"Out of Stock"`, `"Archived"` as status labels; product names like `"Pro Plan"`, `"Starter Bundle"`.
- For a generic SaaS: use `"Pending"`, `"Active"`, `"Suspended"` as status labels; user names like `"Jordan Diaz"`, `"Morgan Lee"`.
- **Always use domain vocabulary found in the source repo** over generic fallbacks. Read the enums/constants files if they exist.

---

### Step 5 — Write the file

Write the story to `{componentPath}/{filename}.stories.tsx`.

If the component file is at `src/components/ui/badge.tsx`, write to `src/components/ui/badge.stories.tsx`.

If `overwrite=enrich` and the file already exists:

- Read the existing file
- Identify which `export const {Name}: Story` exports already exist
- Append ONLY the missing story exports at the end of the file
- Do NOT modify existing exports

---

## Handling Complex Interactive Components

These component types require special treatment:

### Calendar / DatePicker (react-day-picker)

```tsx
// ALWAYS use useState for selected date — Calendar is uncontrolled without it
export const Default: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />;
  },
};
export const Variants: Story = {
  render: () => {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(new Date().setDate(new Date().getDate() - 4)),
      to: new Date(),
    });
    return <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className="rounded-md border" />;
  },
};
```

### Chart (recharts / shadcn chart)

```tsx
// Read ChartConfig type from chart.tsx exports
// Use hsl(var(--chart-1)) through --chart-5 for colors
// Derive data shape from how the chart is used in feature pages (look for useQuery + chart renders)
// Fallback: use a 4-week time series with 2 metrics matching the app domain
```

### Form (react-hook-form)

```tsx
// Always wrap in useForm()
// Use FormField > FormItem > FormControl > FormLabel > FormMessage structure
// Derive field names and labels from the closest form usage in feature pages
// Always include a submit handler and a "submitted" display state
```

### Sidebar / Sheet / Dialog (full-height or overlay)

```tsx
// parameters: { layout: "fullscreen" } for Sidebar
// Dialog: use controlled open state with useState(true) so it renders open in Storybook
// Sheet: same pattern as Dialog
// Sidebar: wrap in SidebarProvider with defaultOpen={true}
```

### Command palette (cmdk)

```tsx
// Use static CommandList with 5-8 real domain options
// Show two CommandGroup instances to demonstrate grouping
```

---

## Validation

After generating all story files, run the following checks:

1. **TypeScript compile check**: Run `npx tsc --noEmit` in the source repo root. Report any type errors in generated story files and fix them.

2. **Import verification**: Confirm every named import in each generated story file matches an actual export from the component file. Use grep or file read to verify — do not rely on inference.

3. **Storybook build check** (optional, only if explicitly requested by user or if `package.json` has a `storybook:build` script): Run `pnpm run storybook:build`. Report any render errors.

---

## Output summary

After writing all files, output:

```
## Stories Generated

| Component | File | Stories | Status |
|-----------|------|---------|--------|
| Badge | src/components/ui/badge.stories.tsx | Default, Variants | ✓ written |
| Button | src/components/ui/button.stories.tsx | Default, Variants, States, States2, States3 | ✓ written |
| Calendar | src/components/ui/calendar.stories.tsx | Default, Variants | ✓ written |
| Card | src/components/ui/card.stories.tsx | — | skipped (overwrite=skip) |

Total: {N} generated, {M} skipped, {K} enriched
TypeScript check: PASS / FAIL (list errors)
```

---

## Integration with migration workflow

This prompt is designed to run **before `/migrate-extract`** as an optional enrichment step.

When stories exist (either pre-existing or generated by this prompt), the `source-component-inventory` agent in `/migrate-extract` reads them alongside the component `.tsx` source and includes them as a `storiesCode` block in each component card. This gives the `component-classifier` and `ui-primitive-builder` agents a precise variant matrix and real-world composition context, significantly improving the fidelity of generated `@old-st/ui` primitives.

**Recommended workflow order when stories are missing:**

```
1. /generate-source-stories   ← enriches source Storybook (this prompt)
2. /migrate-extract           ← inventory agent now reads both .tsx + .stories.tsx
3. /migrate-to-specs
4. /migrate-build-ui
5. /migrate-page --mock
6. /migrate-page --wire
```

If stories already exist and look comprehensive, skip step 1 and run `/migrate-extract` directly.
