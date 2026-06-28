# Webapp (`apps/webapp`) Context

This file loads automatically for any file inside `apps/webapp/`. The webapp is a **Next.js App Router** application deployed as a static export (`output: 'export'`) to S3 + CloudFront.

---

## Directory Structure

```
apps/webapp/src/
  app/
    layout.tsx                ← Root shell: ThemeProvider + Providers + Toaster (mounted ONCE here)
    globals.css               ← Tailwind v4 @theme + .dark blocks (mirrored from tokens.ts)
    global-error.tsx          ← Root error boundary (Client Component)
    not-found.tsx             ← 404 page
    loading.tsx               ← Root loading state
    auth/                     ← Public auth pages (login, forgot-password, new-password)
    (protected)/
      layout.tsx              ← Auth guard: useAuth() + useRouter() → /auth/login if not authenticated
      page.tsx                ← Dashboard
      {domain}/               ← One folder per domain (users/, products/, orders/, ...)
        page.tsx              ← Thin orchestrator: wires hooks + child components
        [id]/
          page.tsx            ← Detail page
        error.tsx             ← Segment error boundary (Client Component, renders <SegmentError>)
        loading.tsx           ← Segment loading skeleton (shape-matched to the page)
    design-preview/           ← Internal token/design preview (not protected)
  components/
    layout/
      header.tsx              ← <Header title="..."> — page-level heading bar
      sidebar.tsx             ← <Sidebar> — navigation links
      segment-error.tsx       ← <SegmentError> — shared error boundary render
      table-skeleton.tsx      ← <TableSkeleton> — shared list-page skeleton
    {domain}/                 ← Domain-scoped components (e.g. users/, orders/, products/)
    theme-provider.tsx        ← next-themes <ThemeProvider> wrapper
    theme-toggle.tsx          ← <ThemeToggle> dark/light toggle
  lib/
    status-variants.ts        ← Badge variant mapping per entity status (uses enum constants)
```

---

## Architectural Rules (Strictly Enforced)

### Pages Are Thin Orchestrators

A page component (`page.tsx`) wires hooks, state, and child components. It does **not** contain table markup, form fields, or direct API calls. All visual structure lives in `components/{domain}/`.

### All API Communication via `@mma/client-common`

Never call `fetch` or Axios directly from page or component code. Always use:
- Domain React Query hooks (`useUsers`, `useOrders`, etc.) from `@mma/client-common`
- Typed API clients in `packages/client-common/src/infrastructure/api-clients/`

### UI Primitives from `@mma/ui` Only

Never write raw `<table>`, `<button>`, or `<input>` elements. Use the shared shadcn-style components:

```tsx
import { Badge, Button, Card, Table, Input, Select, Dialog, Skeleton } from '@mma/ui';
```

If a needed primitive doesn't exist, add it to `packages/ui/src/components/` — see the `webapp-ui-primitive` skill.

### DataTable vs Table (Selection Rule)

One rule: use `DataTable` for domain list pages; use `Table` only when you intentionally want full manual control.

Use `DataTable` by default for webapp list surfaces that need table behavior:
- Sorting
- Row selection
- Column visibility toggles
- Custom column renderers (CTA buttons, badges, action menus)
- Toolbar integrations via table instance state

Use `Table` only for lightweight read-only layouts where no headless table state is required.

References:
- `packages/ui/src/components/data-display/data-table/data-table.tsx`
- `packages/ui/src/components/data-display/table/table.tsx`

### Auth Guard Pattern (Static Export Mode)

The `(protected)/layout.tsx` redirects unauthenticated users **client-side** using `useAuth()` + `useRouter()`. There is no `middleware.ts` (incompatible with `output: 'export'`).

```tsx
// (protected)/layout.tsx pattern
const { isAuthenticated, isLoading } = useAuth();
useEffect(() => {
  if (!isLoading && !isAuthenticated) router.replace('/auth/login');
}, [isLoading, isAuthenticated, router]);
```

### Contract Imports — Domain-Scoped Only

Always import from `@mma/contracts/{domain}` — **never** from the bare `@mma/contracts` root (Golden Rule #11):

```tsx
// ✅ correct
import { EntityStatusEnum, type EntityResponse } from '@mma/contracts/{domain}';

// ❌ forbidden
import { UserStatusEnum } from '@mma/contracts';
```

### Status Badge Variants — Enum Constants, Not Strings

`apps/webapp/src/lib/status-variants.ts` maps entity statuses to badge variants using enum constants:

```ts
// ✅ correct
import { EntityStatusEnum } from '@mma/contracts/{domain}';
export const entityStatusVariants: Record<string, BadgeVariant> = {
  [EntityStatusEnum.ACTIVE]: 'success',
  [EntityStatusEnum.PENDING]: 'warning',
};

// ❌ forbidden
export const userStatusVariants = { ACTIVE: 'success', PENDING: 'warning' };
```

### `'use client'` Directive

`'use client'` marks a **React Server Component boundary** — it is about RSC, not about SSG vs SSR. Even though this app uses `output: 'export'` (everything pre-renders to static HTML at build time), the directive still controls what ships as interactive JS to the browser.

**`'use client'` does NOT propagate from parent to child.** Each file is independent. A `page.tsx` without the directive is a Server Component even if its parent `layout.tsx` has it.

Add `'use client'` to any file that uses:
- React hooks (`useState`, `useEffect`, `useRef`, any `use*`)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `document`, `localStorage`)

Leave it off (Server Component) when the file is purely structural markup — this keeps the JS bundle lighter.

**Quick reference for this codebase:**

| File | `'use client'`? | Reason |
|---|---|---|
| `(protected)/layout.tsx` | ✅ required | Uses `useAuth`, `useRouter`, `useEffect` |
| `page.tsx` (list/detail with data) | ✅ required | Uses React Query hooks |
| `page.tsx` (static dashboard card) | ❌ not needed | No hooks or interactivity |
| Domain components (`*-table.tsx`, `*-form.tsx`) | ✅ required | Use hooks and event handlers |
| `error.tsx` | ✅ required | Next.js mandates Client Component |
| `loading.tsx` | ❌ not needed | Renders a skeleton, no hooks |
| `not-found.tsx` | ❌ not needed | Static markup |
| `global-error.tsx` | ✅ required | Next.js mandates Client Component |

---

### Tailwind Classes — No Dynamic Interpolation

Tailwind v4 JIT only emits CSS for class names it can statically read. Never interpolate Tailwind prefixes:

```tsx
// ❌ produces NO styles at runtime
className={`bg-${color}-500`}

// ✅ use cva() literal maps or inline style for fully dynamic values
```

### No Hard-Coded Colors

Use semantic Tailwind utilities (`bg-card`, `text-muted-foreground`, `border-border`) — never `bg-[#...]` or `text-blue-500`. Colors live in `packages/design-tokens/src/lib/tokens.ts` and are mirrored into `globals.css` via `tokens.css`.

### Timezone Handling — UTC in, local out

**The backend always stores and returns timestamps in UTC.** The frontend is solely responsible for converting to the display timezone — never ask the backend for a pre-formatted local time.

**Default display timezone: `Europe/London`** (covers GMT in winter, BST in summer automatically). Override per-project when requirements differ.

The helpers live in `@mma/client-common` (shared with mobile — implemented in `packages/client-common/src/lib/format-date.ts`):

```tsx
import { formatDate, formatDateTime, formatTime } from '@mma/client-common';

<span>{formatDateTime(order.createdAt)}</span>   // '13 May 2026, 14:30'
<span>{formatDate(user.dateCreated)}</span>       // '13 May 2026'
<span>{formatTime(order.createdAt)}</span>        // '14:30'
```

**Rules:**
- Never call `new Date().toString()` or `.toLocaleDateString()` — they use the browser's OS locale, which is unpredictable across machines.
- Never pass a pre-formatted string from the backend — always receive ISO 8601 UTC and format in the frontend.
- Never hardcode `'en-GB'` locale in individual components — it lives only in `format-date.ts`.
- To use the **client's own browser timezone** instead of the default, pass `Intl.DateTimeFormat().resolvedOptions().timeZone` as the `timeZone` argument.

---

## Form Component Pattern (`<Form structure={...}>`)

> **Status: planned — not yet added to `@mma/ui`.** When the `Form` primitive is added, use this pattern. Until then, compose forms manually with `react-hook-form` + `<FormField>` per the `webapp-form-with-validation` skill.

The `Form` component is a **structure-driven** wrapper — the entire form layout is declared as a data structure (`FormSection[]`), not as JSX. This is the preferred pattern for standard CRUD forms; manual `<FormField>` composition is reserved for custom or non-standard layouts.

### Types

```ts
// Defined in packages/ui/src/types/form.ts (planned)

export type FieldType = 'input' | 'textarea' | 'select' | 'checkbox';
export type InputType = 'text' | 'password' | 'number';

export type Option = {
  value: string | number;
  label: string;
};

export type FormStructureItem = {
  label: string;
  name: string;
  fieldType?: FieldType;        // default: 'input'
  inputType?: InputType;        // default: 'text'
  placeholder?: string;
  options?: Option[];           // required when fieldType='select'
  maxLength?: number;
  disabled?: boolean;
  extra?: string | React.ReactNode; // helper text / extra detail below the field
  isSpacer?: boolean;           // renders an invisible flex-1 gap in a row
  autoComplete?: string;
};

export type FormSection = {
  sectionTitle?: string;
  fields: FormStructureItem[][];  // 2D: rows × columns — items in the same row render side-by-side
};
```

### Props

```ts
interface FormProps<T> {
  structure: FormSection[];
  schema: ZodSchema<T>;           // Zod schema (zodResolver) — NOT Yup
  data?: DefaultValues<T>;        // initial values (react-hook-form DefaultValues)
  onSubmitForm: (data: T) => void;

  submitLabel?: string;           // default: 'Submit'
  isProcessing?: boolean;         // disables submit, shows spinner
  withCloseButton?: boolean;
  closeLabel?: string;            // default: 'Close'
  onClose?: () => void;

  resultError?: Record<string, string>;  // server-side field errors (e.g. from 400 response)
  resetResultError?: () => void;

  children?: ReactNode;           // rendered above the action buttons (e.g. terms notice)
  className?: string;
}
```

### Structure example

```ts
// Define structure and schema separately — keep them co-located with the page/component

import { z } from 'zod';
import { FormSection } from '@mma/ui';

export const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Enter a valid email'),
  role:      z.enum(['USER', 'ADMIN']),
  notes:     z.string().max(250).optional(),
});

export const createUserStructure: FormSection[] = [
  {
    sectionTitle: 'Personal details',
    fields: [
      [
        { label: 'First Name', name: 'firstName', placeholder: 'Jane' },
        { label: 'Last Name',  name: 'lastName',  placeholder: 'Doe'  },
      ],
      [
        { label: 'Email', name: 'email', inputType: 'text', placeholder: 'jane@example.com' },
      ],
    ],
  },
  {
    sectionTitle: 'Account',
    fields: [
      [
        {
          label: 'Role', name: 'role', fieldType: 'select',
          options: [
            { label: 'User',  value: 'USER'  },
            { label: 'Admin', value: 'ADMIN' },
          ],
        },
      ],
      [
        { label: 'Notes', name: 'notes', fieldType: 'textarea', placeholder: '...', maxLength: 250 },
      ],
    ],
  },
];
```

### Usage in a page component

```tsx
import { Form } from '@mma/ui';
import { createUserSchema, createUserStructure } from './create-user.structure';

export function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateUser();

  return (
    <Form<CreateUserInput>
      structure={createUserStructure}
      schema={createUserSchema}
      submitLabel="Create User"
      isProcessing={isPending}
      onSubmitForm={(data) => mutate(data, { onSuccess })}
    />
  );
}
```

### Layout rules

- Items in the same **row array** (`fields[n]`) render **side-by-side** with `flex gap-3`. Use `isSpacer: true` to add an invisible flex-1 gap in a row.
- Each section with a `sectionTitle` renders an `h6` heading above its rows.
- The submit (and optional close) button row is always rendered at the bottom by the component — never add buttons manually inside the form.
- `resultError` feeds server-side field errors (from `ApiError.fieldErrors`) directly into the field's `helperText` — clear them via `resetResultError` on field change.

### Rules

1. **Schema lives in `@mma/contracts/{domain}` — never duplicated in the component file.** Import and re-use the contract's Zod schema directly as the `schema` prop.
2. **Use `zodResolver` — never `yupResolver`.** The old project used Yup; this codebase uses Zod throughout.
3. **Structure arrays are co-located with their page/component** (`create-user.structure.ts` next to `create-user-form.tsx`) — not in the domain package.
4. **Password fields get show/hide toggle automatically** when `inputType: 'password'` — no extra wiring needed.
5. **For non-standard layouts** (multi-step, conditional fields, custom field ordering at runtime), fall back to manual `<FormField>` composition per the `webapp-form-with-validation` skill.

---

## Error Boundaries and Loading States

Every protected route segment **must** have:
- `error.tsx` — Client Component that renders `<SegmentError>` from `@/components/layout/segment-error`
- `loading.tsx` — Shape-matching skeleton: `<TableSkeleton>` for list pages, a domain-specific skeleton for detail pages

The root has `global-error.tsx` and `not-found.tsx`.

---

## Forms

All forms use `react-hook-form` + Zod resolver, with the schema sourced from `@mma/contracts/{domain}`. Never duplicate Zod schemas in the webapp. Use the `<FormField>` / `<FormItem>` / `<FormControl>` / `<FormMessage>` wrappers from `@mma/ui`.

### Zod Error Messages (`apps/webapp/src/lib/zod-error-map.ts`)

**Contract schemas are structural only — they never contain user-facing error message strings.** Human-readable validation messages are owned by the webapp in a single `zod-error-map.ts` file wired once at startup.

**Why this split:** contracts express structural rules (type, length, pattern). The webapp expresses user-facing wording. These are different concerns — changing copy means editing one file, not hunting through every schema. The NestJS `ZodValidationPipe` in the backend is completely unaffected.

```ts
// apps/webapp/src/lib/zod-error-map.ts
import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

export const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Please enter a valid email address' };
      break;
    case ZodIssueCode.too_small:
      if (issue.type === 'string' && issue.minimum === 1) return { message: 'This field is required' };
      return { message: `Must be at least ${issue.minimum} characters` };
    case ZodIssueCode.too_big:
      return { message: `Must be no more than ${issue.maximum} characters` };
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'This field is required' };
      break;
  }
  return { message: ctx.defaultError };
};

// Wire globally — runs once on import, no hook or effect needed
z.setErrorMap(zodErrorMap);
```

Wire it in `apps/webapp/src/app/layout.tsx` as a side-effect import — one line, before anything renders:

```tsx
// apps/webapp/src/app/layout.tsx
import '@/lib/zod-error-map'; // ← global error map, must be first
import './globals.css';
// ... rest of layout
```

**Rules:**
- This file is the **single source of truth** for all form validation copy in the webapp.
- Never add `.min(1, 'This field is required')` or any message string inside a contract schema.
- Never add per-field `message` overrides in the `resolver` call — the global map handles them.
- If a specific field needs a one-off message that the global map can't express (e.g. a domain-specific regex), add it to the error map with a path check, not in the contract.

---

## Toasts

All mutations surface feedback via `toast` from `@mma/ui` (sonner). Never use `alert()` and never leave mutations silent. The `<Toaster>` is mounted **once** in `apps/webapp/src/app/layout.tsx` — do not add it anywhere else.

---

## Dark Mode

`<ThemeProvider>` wraps the app in `layout.tsx` with `<html suppressHydrationWarning>`. Every new color must be added to **both** the `@theme` and `.dark` blocks in `globals.css`. The `<ThemeToggle>` in the Header uses a `mounted` guard to prevent hydration mismatches.

---

## Additional Enforced Rules

**23. API client responses must be Zod-parsed.** Every API client method in `client-common` passes a `schema` option to `apiRequest()` so responses are validated at runtime against the contract schema.

**23d. Interactive UI primitives wrap Radix.** When an accessible primitive is needed (Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Label, Separator, Command), wrap Radix in `@mma/ui` — never hand-roll keyboard/focus management. See the `webapp-radix-primitive-wrap` skill.

**23g. Cursor-paginated infinite lists** use the domain-specific infinite hooks in `@mma/client-common` (`useXxxByStatusInfinite`). Prisma/offset domains stay paginated. See the `webapp-cursor-infinite-scroll` skill.

**23h. Optimistic mutations** use the `optimisticMutation` helper or the hand-rolled `onMutate`/`onError`/`onSettled` pattern. Pair every optimistic mutation with an error toast. See the `webapp-optimistic-mutations` skill.

**23i. File uploads** use `<FileDropzone>` from `@mma/ui` + the `useFileUpload` hook from `@mma/client-common`. Upload bytes go directly to S3 via a presigned URL — never through a domain backend (Golden Rule #37). See the `webapp-file-upload-ux` skill.

**23l. Accessibility.** Every top-level page must pass `@axe-core/playwright` scans for `critical` + `serious` violations. New routes are added to `PAGES_TO_SCAN` in `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts`. See the `fe-accessibility-audit` skill.

**23m. Bundle analysis.** Audit before adding any > 50 KB dependency via `ANALYZE=true pnpm nx run webapp:build` (`@next/bundle-analyzer`, opt-in). See the `fe-performance-bundle-analysis` skill.

**23n. Every `@mma/ui` primitive ships four files:** `{name}.tsx` + `index.ts` + `{name}.stories.tsx` + `{name}.spec.tsx`. No SCSS/Sass/styled-components/Emotion/CSS Modules anywhere in `packages/ui/` — Tailwind v4 utilities + `cva()` only. See the `webapp-ui-primitive` skill.

---

## `data-testid` Conventions (E2E)

Every interactive or data-bearing component must carry a `data-testid` attribute following this pattern:

| Element | Pattern | Example |
|---|---|---|
| Domain table | `{domain}s-table` | `users-table` |
| Table row | `{domain}-row-{id}` | `user-row-abc123` |
| Status filter | `status-filter` | `status-filter` |
| Create button | `create-{domain}-btn` | `create-user-btn` |
| Status badge | `{domain}-status-badge` | `user-status-badge` |
| Create/edit form | `create-{domain}-form` | `create-user-form` |
| Sidebar link | `sidebar-link-{label}` | `sidebar-link-users` |

Add new domain selectors to `apps/webapp-e2e/src/utils/selectors.ts`.

---

## Test Coverage Threshold

70% all metrics (configured in `apps/webapp/jest.config.cts`). Components with conditional rendering logic (status-dependent buttons, data-driven tables) always require tests. Thin pages are optional.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Adding a new page or domain component | `webapp-new-page` |
| Adding API clients + React Query hooks | `webapp-api-client-hooks` |
| Building a form with validation | `webapp-form-with-validation` |
| Adding `error.tsx` / `loading.tsx` / `not-found.tsx` | `webapp-error-boundaries` |
| Adding skeleton loaders | `webapp-skeleton-loading` |
| Wiring toast notifications | `webapp-toast-notifications` |
| Adding a new shared UI primitive | `webapp-ui-primitive` |
| Wrapping a Radix primitive | `webapp-radix-primitive-wrap` |
| Sortable / selectable tables | `webapp-data-table` |
| Cursor-paginated infinite scroll | `webapp-cursor-infinite-scroll` |
| Optimistic mutations | `webapp-optimistic-mutations` |
| File upload UX | `webapp-file-upload-ux` |
| Dark mode wiring | `webapp-dark-mode` |
| Design tokens | `fe-design-tokens` |
| Accessibility audit | `fe-accessibility-audit` |
| Bundle analysis | `fe-performance-bundle-analysis` |
| Writing component/utility tests | `write-webapp-tests` |
| Writing Playwright E2E specs | `write-webapp-e2e-tests` |
| Auth middleware (SSR mode only) | `webapp-auth-middleware` |

**Always read the relevant skill BEFORE editing this package.**

---

## Workflow Prompts

| Prompt | When to use |
|---|---|
| `webapp-feature.md` | Adding any page or feature against an existing backend |
| `full-stack-feature.md` | Backend + webapp changes together |
| `new-ui-primitive.md` | New shared primitive for web + mobile |
| `fe-accessibility-pass.md` | Accessibility audit pass |
| `figma-component.md` | One Figma component → `@mma/ui` primitive |
| `figma-page.md` | One Figma screen → Next.js page |
