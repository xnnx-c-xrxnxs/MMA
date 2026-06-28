# Webapp Development Handbook

> Team reference for building the Next.js webapp. Covers architectural decisions, conventions, and day-to-day patterns.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind v4 + CSS variables |
| **UI primitives** | `@old-st/ui` (shadcn-style, Radix-backed) |
| **Data fetching** | React Query v5 via `@old-st/client-common` |
| **Forms** | `react-hook-form` + Zod resolver |
| **Types / validation** | Zod schemas from `@old-st/contracts/{domain}` |
| **Auth** | `AuthProvider` + httpOnly cookie refresh |
| **Toasts** | sonner via `@old-st/ui` |
| **Theme** | `next-themes` (dark / light) |
| **Testing** | Jest + React Testing Library |
| **E2E** | Playwright |
| **Deployment** | Static export (`output: 'export'`) → S3 + CloudFront |

### What We Don't Use (and Why)

| Technology | Reason |
|---|---|
| Redux / Zustand / MobX | React Query handles server state. `useState` handles UI state. |
| Axios | `@old-st/client-common` uses typed `fetch` + Zod — better safety, smaller bundle. |
| CSS Modules / styled-components | Tailwind v4 + semantic CSS variables. Single styling system, dark mode for free. |
| `next/middleware.ts` auth guard | Incompatible with `output: 'export'`. Auth redirect is client-side via `useAuth()` + `useRouter()` in `(protected)/layout.tsx`. |
| Server Actions | All mutations go through the shared API clients in `@old-st/client-common` so both webapp and mobile share the same layer. |

---

## 2. Architectural Rationale

### Why static export?

We deploy as a fully static site (HTML + JS + CSS) to S3 + CloudFront. This gives us:

- **Zero server cost** — no Node.js process to keep running
- **Global CDN** — CloudFront serves assets from the edge
- **Simplicity** — no Lambda containers, no cold starts, no SSR complexity

The trade-off is that all data fetching happens client-side (React Query), and auth redirects are client-side (not server-side middleware). For an internal admin dashboard this is perfectly acceptable.

### Why separate from the API?

The webapp communicates with backend microservices via HTTP. It never imports backend domain packages directly. All API communication goes through `@old-st/client-common`, which is also shared with the mobile app — meaning hooks and API clients are written once and work on both platforms.

### Why `@old-st/contracts/{domain}` for schemas?

Zod schemas are defined once in the contracts packages and re-used by:
- **NestJS** — `ZodValidationPipe` validates incoming requests
- **API clients** — `apiRequest()` validates responses at runtime
- **Forms** — `zodResolver(schema)` drives `react-hook-form` validation

This means a schema change in contracts surfaces compile errors everywhere at once.

---

## 3. Folder Structure

```
apps/webapp/
├── next.config.js            ← output: 'export', transpilePackages
├── components.json           ← shadcn config (for adding new Radix primitives)
├── jest.config.cts           ← Jest config (70% coverage threshold)
└── src/
    ├── app/                  ← ROUTES — Next.js App Router
    │   ├── layout.tsx        ← Root shell: ThemeProvider + Providers + Toaster
    │   ├── globals.css       ← Tailwind v4 @theme + .dark blocks
    │   ├── global-error.tsx  ← Root error boundary (Client Component)
    │   ├── not-found.tsx     ← 404 page
    │   ├── loading.tsx       ← Root loading state
    │   ├── auth/             ← Public pages (login, forgot-password, new-password)
    │   └── (protected)/      ← Auth-gated route group
    │       ├── layout.tsx    ← Auth guard → /auth/login if not authenticated
    │       ├── page.tsx      ← Dashboard
    │       └── {domain}/     ← One folder per domain
    │           ├── page.tsx       ← Thin orchestrator (hooks + child components)
    │           ├── error.tsx      ← Segment error boundary
    │           ├── loading.tsx    ← Segment loading skeleton
    │           └── [id]/
    │               └── page.tsx  ← Detail page
    │
    ├── components/           ← UI COMPONENTS
    │   ├── layout/
    │   │   ├── header.tsx         ← <Header title="...">
    │   │   ├── sidebar.tsx        ← <Sidebar> navigation
    │   │   ├── segment-error.tsx  ← <SegmentError> shared error render
    │   │   └── table-skeleton.tsx ← <TableSkeleton> shared list skeleton
    │   ├── {domain}/         ← Domain-scoped components
    │   ├── theme-provider.tsx
    │   └── theme-toggle.tsx
    │
    └── lib/                  ← UTILITIES — pure functions, no React
        ├── zod-error-map.ts  ← Global Zod error messages (wired in layout.tsx)
        └── status-variants.ts ← Badge variant mapping per entity status
```

---

## 4. Core Patterns

### Pages are thin orchestrators

A `page.tsx` only wires hooks, state, and child components. No table markup, no form fields, no fetch calls. All visual structure lives in `components/{domain}/`.

```tsx
// ✅ correct — page.tsx
export default function UsersPage() {
  const [status, setStatus] = useState(UserStatusEnum.ACTIVE);
  const { data, isLoading } = useUsers({ status });
  return (
    <>
      <Header title="Users" />
      <UsersTable data={data} isLoading={isLoading} onStatusChange={setStatus} />
    </>
  );
}

// ❌ wrong — table markup directly in page.tsx
export default function UsersPage() {
  return <table>...</table>;
}
```

### All API calls through `@old-st/client-common`

Never call `fetch` directly. Domain hooks are the only entry point to the API.

```tsx
// ✅ correct
import { useUsers, useCreateUser } from '@old-st/client-common';

// ❌ wrong
const res = await fetch('/api/users');
```

### Contract imports are always domain-scoped

```tsx
// ✅ correct
import { EntityStatusEnum } from '@old-st/contracts/{domain}';

// ❌ wrong — bare root import
import { UserStatusEnum } from '@old-st/contracts';
```

### Forms use the Zod error map, not inline messages

Schemas in `@old-st/contracts/{domain}` are **structural only** — no message strings. The global `zod-error-map.ts` (wired once in `layout.tsx`) translates Zod issue codes to human-readable copy. This means all validation wording is in one file.

```ts
// ✅ correct — contract schema has no messages
email: z.string().email()

// ❌ wrong — message string in the contract
email: z.string().email('Please enter a valid email address')
```

### Timestamps are always formatted client-side

The backend returns UTC. Always convert to the display timezone in the frontend using the shared helpers:

```tsx
import { formatDate, formatDateTime } from '@old-st/client-common';

<span>{formatDateTime(order.createdAt)}</span>  // '13 May 2026, 14:30' (Europe/London)
```

---

## 5. `'use client'` Quick Reference

`'use client'` marks a React Server Component boundary. It does **not** propagate — each file that needs it must declare it explicitly.

**Add it** when the file uses hooks, event handlers, or browser APIs.  
**Leave it off** when the file is pure markup — it ships no JS and produces a lighter page.

| File | Needs it? |
|---|---|
| `(protected)/layout.tsx` | ✅ — uses `useAuth`, `useRouter`, `useEffect` |
| `page.tsx` with React Query hooks | ✅ |
| `page.tsx` with only static markup | ❌ |
| Domain components (tables, forms) | ✅ |
| `error.tsx` | ✅ — Next.js requirement |
| `global-error.tsx` | ✅ — Next.js requirement |
| `loading.tsx` | ❌ — renders a skeleton, no hooks |
| `not-found.tsx` | ❌ — static markup |

---

## 6. Error Boundaries and Loading States

Every protected route segment must have both:

- **`error.tsx`** — Client Component, renders `<SegmentError>` from `@/components/layout/segment-error`
- **`loading.tsx`** — Shape-matching skeleton: `<TableSkeleton>` for list pages, a domain-specific skeleton for detail pages

The root already has `global-error.tsx` and `not-found.tsx`.

---

## 7. Testing

- **Unit tests** — co-located `.spec.tsx` next to the source file
- **E2E tests** — Playwright specs in `apps/webapp-e2e/src/specs/{domain}/`
- **Coverage threshold** — 70% all metrics (configured in `jest.config.cts`)
- Components with conditional rendering (status-dependent buttons, data-driven tables) always need tests. Thin pages are optional.

Run tests:
```sh
pnpm nx test webapp          # unit tests
pnpm nx e2e webapp-e2e       # Playwright E2E
```

---

## 8. Design Tokens

Design tokens live in `packages/design-tokens/src/lib/tokens.ts` and are the **single source of truth** for all colors, spacing, radii, and typography across the webapp and mobile app.

### How it works

```
tokens.ts  (JS values — edited here)
    │
    ├─ pnpm tokens:gen ──→  tokens.css  (@theme directives, Tailwind v4)
    │                            │
    │                            ├─ apps/webapp/src/app/globals.css
    │                            └─ packages/ui/.storybook/preview.css
    │
    └─ imported directly (TypeScript) by  mobile-ui
```

Tailwind v4 reads the `@theme` block in `tokens.css` to expose CSS custom properties (`--color-brand-50`, `--color-danger-600`, …) that power all semantic utilities (`bg-brand-50`, `text-danger-600`, etc.).

> `mobile-ui` imports `lightColors` / `darkColors` directly from `tokens.ts` (TypeScript source) — it does **not** use `tokens.css`. You don't need to run `pnpm tokens:gen` for mobile-only token changes.

### Syncing from Figma

Primitive color scales (brand, gray, danger, warning, success) are synced from the Cousteau Figma file using the **Variable Gen JSON** plugin.

**One-time setup — install the plugin in Figma:**
> `figma.com/community/plugin/1572805660073830528`

**Each sync (when Cousteau palette changes):**

1. Open the Cousteau file in Figma
2. Run **Variable Gen JSON** → `variables.json` downloads automatically
3. Run the sync:
   ```bash
   pnpm tokens:sync --from-file ~/Downloads/variables.json
   ```
4. Regenerate the CSS:
   ```bash
   pnpm tokens:gen
   ```
5. Verify in Storybook:
   ```bash
   pnpm nx run ui:storybook
   # Design Tokens → Tier 1 — Numeric Scales (light / dark)
   ```

> The script patches only the **primitive hex values** inside the `FIGMA:SYNC` sentinel block in `tokens.ts`. Semantic aliases and non-color tokens are never touched.

### What syncs automatically vs. what needs manual updates

| Token type | Synced? | Where in `tokens.ts` |
|---|---|---|
| Color scales (`brand50`–`brand950`, `gray50`–`gray950`, etc.) | ✅ Auto | `FIGMA:SYNC` block |
| Semantic aliases (`background`, `surface`, `brand-hover`, etc.) | ❌ Manual | Below `FIGMA:SYNC` block |
| Spacing, radii, typography | ❌ Manual | `spacing`, `radii`, `fontSizes` exports |

### Adding a new palette

If Cousteau ships a new color group not already in `tokens.ts`:

1. Manually add the new scale keys to the `FIGMA:SYNC` block in `tokens.ts`
2. Run `pnpm tokens:gen` to emit the new CSS variables
3. If the Figma group name differs from the token prefix (e.g. `"Gray (light mode)"` → `gray`), add a mapping to `COMPACT_PRIMITIVE_GROUPS` in `scripts/sync-figma-tokens.mjs`

### Never hard-code colors in components

Always use Tailwind semantic utilities (`bg-card`, `text-muted-foreground`, `border-border`) or token-based utilities (`bg-brand-600`) — never raw hex or `style={{ color: '#7F56D9' }}`. This ensures dark mode and future Figma palette updates apply automatically.

```tsx
// ✅ correct
<div className="bg-brand-600 text-white rounded-md">

// ❌ wrong — bypasses the token system
<div style={{ backgroundColor: '#7F56D9', color: '#fff' }}>
```

---

## 9. Using Icons

Icons live in `packages/ui/src/icons/` and are exported from `@old-st/ui`. Every icon is a `React.forwardRef` component that accepts the shared `IIcon` interface.

### Importing an existing icon

```tsx
import { ClockIcon, PlusIcon, TrashIcon } from '@old-st/ui';

// Inherit surrounding text color (recommended)
<button className="text-brand">
  <PlusIcon size={20} />
</button>

// Override color with a Tailwind utility (preferred over the `color` prop)
<TrashIcon className="text-destructive" size={16} />

// Make it accessible to screen readers
<ClockIcon aria-label="Last updated" size={24} />
```

**Full `IIcon` interface:**

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `number` | `24` | Sets both `width` and `height` in px |
| `className` | `string` | — | Tailwind utilities — preferred way to set color |
| `color` | `string` | `currentColor` | Rarely needed — use `className` instead |
| `aria-label` | `string` | — | When set, icon is announced to screen readers |

### Sizing

Two equivalent ways — both work:

```tsx
<ClockIcon size={20} />           // numeric prop → width/height="20"
<ClockIcon className="h-5 w-5" /> // Tailwind utility
```

### Current icon set

Run `pnpm nx run ui:storybook` and open **Icon Set** to browse every available icon. Alternatively, the barrel lists them all in `packages/ui/src/icons/index.ts`.

---

### Adding new icons

Always use `/svg-to-icons` — it updates `icons.tsx`, `index.ts`, `icons.stories.tsx`, and `icons.spec.tsx` regardless of how many icons you're adding.

#### Adding one icon

```
@svg-to-icons
```

Paste a single `<svg>...</svg>` block when prompted. The prompt detects the icon name, normalizes the SVG, shows a preview, then writes all four files and runs the type check.

#### Adding multiple icons at once (bulk)

```
@svg-to-icons
```

Three equivalent entry points — pick whichever matches how you have the SVGs:

| You have… | Tell the prompt… |
|---|---|
| SVG files in a folder | `"SVGs are in ~/Downloads/icons/"` — the prompt runs the script with `--svg-dir` |
| SVG files already dropped in `packages/ui/src/icons/svg/` | `"SVGs are in packages/ui/src/icons/svg/"` — same as above, uses the default folder |
| SVG markup to paste | Paste all blocks separated by blank lines |

The prompt processes all icons in one pass, resolves name collisions, and updates every file in a single batch — no manual barrel or story edits needed.

> **Why not `pnpm icons:add` directly?** That script only regenerates `icons.tsx` — it does not touch `index.ts` or `icons.stories.tsx`. Always go through the prompt so all files stay in sync.

#### Path B — No SVG files (write the component manually)

Open `packages/ui/src/icons/icons.tsx` and add a component using the `iconAttrs()` helper. Copy the SVG path data from any icon source (Heroicons, Lucide, custom design).

```tsx
export const ChevronLeftIcon = React.forwardRef<SVGSVGElement, IIcon>((props, ref) => (
  <svg ref={ref} {...iconAttrs(props)} xmlns="http://www.w3.org/2000/svg">
    <path d="M15 18 9 12l6-6" />
  </svg>
));
ChevronLeftIcon.displayName = 'ChevronLeftIcon';
```

Then add it to `packages/ui/src/icons/index.ts` alphabetically.

---

### Rules

- **Never hard-code a color** (`fill="#7f56d9"`, `stroke="#000"`) — icons must use `currentColor` so they respect Tailwind text utilities and dark mode.
- **Never import SVGs directly** (`import Logo from './logo.svg'`) — use the icon component pattern so sizing, accessibility, and color control are consistent.
- **`aria-hidden="true"` is the default** — the `iconAttrs()` helper sets this automatically. Only pass `aria-label` when the icon is the sole label of an interactive element.
- Icons are part of `@old-st/ui` — never create ad-hoc icon components inside `apps/webapp/`.

---

## 10. Adding a New UI Primitive

All web UI components live in `packages/ui/src/components/{category}/{name}/` and follow the **four-file layout**: `{name}.tsx`, `index.ts`, `{name}.stories.tsx`, `{name}.spec.tsx`.

### Use the generator

Do not create the four files by hand — use the `@old-st/nx-plugin:ui-primitive` generator:

```sh
pnpm nx g @old-st/nx-plugin:ui-primitive
# Interactive: prompts for name, category, and pattern.

# Or non-interactively:
pnpm nx g @old-st/nx-plugin:ui-primitive \
  --name=Switch \
  --category=form-controls \
  --pattern=simple-variants
```

The generator creates all four files in the correct subfolder and adds the export to `packages/ui/src/index.ts`.

**Pattern guide:**

| Pattern | Use when | Examples |
|---|---|---|
| `simple-variants` | Visual variants via `cva` + `forwardRef` | Button, Badge, Avatar, Skeleton |
| `simple-no-variants` | No variants — styling + `forwardRef` only | Input, Label, Separator |
| `compound` | Multiple named sub-components | Card, Table, Dialog stub |

**After the generator runs:**

1. Open `{name}.tsx` and fill in the `// TODO` Tailwind classes — either by hand or from a Figma design (see below).
2. If it wraps a Radix primitive (keyboard / focus management), replace the `<div>` stub with the Radix root.
3. Add meaningful `args` to `{name}.stories.tsx`.
4. Run tests: `pnpm nx test ui --skip-nx-cache`
5. Check the story: `pnpm nx run ui:storybook` → http://localhost:4400

### Starting from a Figma design

If the component is already designed in Figma, paste the node URL and let Claude Code drive step 1 automatically using the **`/figma-component` workflow**. It uses the Figma MCP to pull design context — colors, spacing, variants, dark-mode overrides — and maps them to design tokens.

**Get the Figma node URL:**

In Figma, right-click the component frame → **Copy link to selection**. The URL looks like:

```
https://www.figma.com/design/FILE_KEY/File-Name?node-id=123-456
```

Then tell Claude Code:

```
implement this Figma component: https://www.figma.com/design/FILE_KEY/...?node-id=123-456
```

Claude Code will:
1. Run `get_design_context` to extract a reference React + Tailwind snapshot and a screenshot.
2. Map Figma token names → `@old-st/ui` CSS variables (e.g. `var(--color-brand-600)` → `bg-brand-600`).
3. Fill in the `// TODO` stubs in the generated `.tsx` file.
4. Flag any colors or spacing values that have no token mapping yet.

> The generator still runs first (Phase 0). Provide the Figma URL *after* scaffolding so the skeleton files already exist when Claude Code fills them in.

### Category reference

| Category | Subfolder | Examples |
|---|---|---|
| `form-controls` | `components/form-controls/` | Button, Input, Select, FileDropzone |
| `data-display` | `components/data-display/` | Badge, Card, Table, Skeleton |
| `feedback` | `components/feedback/` | Dialog, Toast, Tooltip, Spinner |
| `navigation` | `components/navigation/` | Tabs, DropdownMenu, Command |
| `layout` | `components/layout/` | Separator |

### Rules

- **No SCSS / styled-components / Emotion** — Tailwind v4 utilities only.
- **No dynamic class interpolation** — `` className={`bg-${color}`} `` produces no styles in Tailwind v4. Use a `cva()` literal map instead.
- Every component must use `React.forwardRef` and set `.displayName`.
- Export both the component and its `cva` variants function (`{name}Variants`) for composition.
- All four files must exist — enforced by the `ui-primitive-has-story-and-spec` lint check.

---

## 11. Further Reading

| Topic | Location |
|---|---|
| Full golden rules + skill map | `apps/webapp/CLAUDE.md` |
| UI primitives (detailed pattern guide) | `packages/ui/CLAUDE.md` |
| Shared data-access layer | `packages/client-common/CLAUDE.md` |
| Design tokens deep-dive | `.claude/skills/fe-design-tokens/SKILL.md` |
| Figma sync prompt | `.claude/commands/sync-figma-tokens.md` |
| Architecture overview | `docs/architecture.md` |
| Getting started (local dev) | `docs/getting-started.md` |
| Testing strategy | `docs/testing.md` |
