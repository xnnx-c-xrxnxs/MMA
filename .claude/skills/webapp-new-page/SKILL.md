---
name: webapp-new-page
description: Add a new page and domain components to the Next.js webapp. Use this when creating a new page route, domain table, create/edit form, action menu, or status-variant mapping in apps/webapp/. Covers the thin-orchestrator page pattern, domain-scoped component structure, sidebar navigation, and status badge wiring.
---

# Adding a Webapp Page + Domain Components

## Required Information — Ask First

Before writing any code, confirm:

1. **Which domain?** (`users`, `orders`, `products`, or a new domain)
2. **What entity is displayed?** (e.g. `User`, `Order`, `Product`)
3. **What list/query hook exists?** (e.g. `useUsersByStatus`) — if none, follow the `webapp-api-client-hooks` skill first
4. **What columns does the table need?** (field names from the entity response type)
5. **Does the page need a create form?** (toggle pattern with a button)
6. **Does the entity have statuses?** (if yes, need status-variant mapping + status filter)
7. **What actions are available per row?** (e.g. activate, deactivate, delete — driven by entity status)
8. **Should this page appear in the sidebar?** (almost always yes)

---

## Ordered Implementation Steps

Work through these steps **in order** — the page depends on components, which depend on hooks.

---

### Step 1 — Verify Hooks + API Client Exist

Before building UI, confirm that the React Query hooks and API client methods exist in `packages/client-common/`.

- **Hooks file:** `packages/client-common/src/hooks/use-{domain}.ts`
- **API client file:** `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
- **Barrel export:** hooks must be exported from `packages/client-common/src/hooks/index.ts`

If any are missing, follow the **`webapp-api-client-hooks`** skill first. Do not proceed without data-fetching hooks.

---

### Step 2 — Status-Variant Mapping (if entity has statuses)

File: `apps/webapp/src/lib/status-variants.ts`

Add a variant mapper function for the new entity:

```typescript
import { {Entity}StatusEnum } from '@mma/contracts/{domain}';

export function {entity}StatusVariant(status: string): BadgeVariant {
  switch (status) {
    case {Entity}StatusEnum.ACTIVE: return 'success';
    case {Entity}StatusEnum.PENDING: return 'warning';
    case {Entity}StatusEnum.INACTIVE: return 'secondary';
    case {Entity}StatusEnum.DELETED: return 'destructive';
    default: return 'outline';
  }
}
```

**Rules:**
- Import the status enum from `@mma/contracts/{domain}` — never hardcode string literals.
- The function name follows `{entity}StatusVariant` (camelCase).
- Return type is `BadgeVariant` (defined at the top of the file).
- Always include a `default: return 'outline'` fallback.
- Map semantics: `success` = positive/active, `warning` = pending/needs-attention, `secondary` = neutral/inactive, `destructive` = error/deleted/cancelled.

---

### Step 2a — Status Label Helper (if entity has statuses)

File: `packages/client-common/src/lib/status-labels/{domain}.ts`

Status enum values are SCREAMING_SNAKE_CASE on the wire (`PAST_DUE`, `VALIDATION_FAILED`) — never render them raw in JSX (Golden Rule #22a). Add a per-domain `format{Entity}Status()` helper that wraps the shared `formatStatus()` utility with an exhaustive label map.

```typescript
import { formatStatus } from '../format-status';
import { {Entity}StatusEnum, type {Entity}Status } from '@mma/contracts/{domain}';

const {ENTITY}_STATUS_LABELS: Readonly<Record<{Entity}Status, string>> = {
  [{Entity}StatusEnum.ACTIVE]: 'Active',
  [{Entity}StatusEnum.PENDING]: 'Pending',
  [{Entity}StatusEnum.INACTIVE]: 'Inactive',
  [{Entity}StatusEnum.DELETED]: 'Deleted',
};

export function format{Entity}Status(status: {Entity}Status): string {
  return formatStatus(status, {ENTITY}_STATUS_LABELS);
}
```

**Rules:**
- The label map MUST be `Readonly<Record<{Entity}Status, string>>` (exhaustive) — adding a new enum value will be a TS error until labelled.
- Default-good values that are already Title Case (`ACTIVE → "Active"`) can fall through to `formatStatus()`'s default behaviour, but listing them explicitly makes intent clear.
- Re-export the helper from `packages/client-common/src/lib/status-labels/index.ts` and from the package's `src/index.ts` barrel.
- Always wrap raw status renders in JSX with this helper: `{format{Entity}Status({entity}.status)}`. Enforced by the `no-raw-status-in-jsx` lint check.

---

### Step 3 — Domain Table Component

File: `apps/webapp/src/components/{domain}/{domain}-table.tsx`

The table component receives the data array as a prop and renders it using `@mma/ui` Table primitives.

```typescript
'use client';

import {
  Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mma/ui';
import { format{Entity}Status } from '@mma/client-common';
import { {entity}StatusVariant } from '@/lib/status-variants';
import { {Entity}Actions } from './{entity}-actions';
import type { {Entity}Response } from '@mma/contracts/{domain}';

export function {Entity}sTable({ {entity}s }: { {entity}s: {Entity}Response[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* Column headers matching entity fields */}
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {{entity}s.map(({entity}) => (
          <TableRow key={{entity}.{entity}Id}>
            <TableCell className="font-medium">...</TableCell>
            <TableCell>
              <Badge variant={{entity}StatusVariant({entity}.status)}>
                {format{Entity}Status({entity}.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date({entity}.dateCreated).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <{Entity}Actions {entity}={{entity}} />
            </TableCell>
          </TableRow>
        ))}
        {{entity}s.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No {entity}s found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
```

**Rules:**
- Always add `'use client'` directive at the top.
- Import UI primitives from `@mma/ui` — never use raw HTML `<table>`.
- Import types from `@mma/contracts/{domain}`.
- Status columns use `<Badge variant={...}>` with the variant mapper from Step 2.
- Date columns format with `toLocaleDateString()` and use `text-muted-foreground` class.
- The `key` prop uses the entity's primary ID field.
- Empty state: a full-width `TableCell` with `colSpan` matching the column count.

---

### Step 4 — Actions Component (if entity has state transitions)

File: `apps/webapp/src/components/{domain}/{entity}-actions.tsx`

The actions component renders context-sensitive buttons based on entity status.

```typescript
'use client';

import { Button } from '@mma/ui';
import { use{Action1}{Entity}, use{Action2}{Entity}, useDelete{Entity} } from '@mma/client-common';
import { {Entity}StatusEnum } from '@mma/contracts/{domain}';
import type { {Entity}Response } from '@mma/contracts/{domain}';

export function {Entity}Actions({
  {entity},
  variant = 'list',
}: {
  {entity}: {Entity}Response;
  variant?: 'list' | 'detail';
}) {
  const delete{Entity} = useDelete{Entity}();
  // ... other mutation hooks

  // list: compact ghost buttons for table rows
  // detail: larger outline buttons for the entity detail page
  const btnProps =
    variant === 'list'
      ? { size: 'sm' as const, variant: 'ghost' as const }
      : { size: 'default' as const, variant: 'outline' as const };

  return (
    <div className="flex gap-1">
      {{entity}.status === {Entity}StatusEnum.PENDING && (
        <Button {...btnProps} onClick={() => ...}>
          Activate
        </Button>
      )}
      {{entity}.status !== {Entity}StatusEnum.DELETED && (
        <Button {...btnProps} className="text-destructive" onClick={() => delete{Entity}.mutate({entity}.{entity}Id)}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

**Rules:**
- Status comparisons use `{Entity}StatusEnum.VALUE` — never string literals.
- Each action maps to a mutation hook from `@mma/client-common`.
- Destructive actions use `className="text-destructive"`.
- Accept `variant?: 'list' | 'detail'` (default `'list'`): list uses `size="sm" variant="ghost"` for table row density; detail uses `size="default" variant="outline"` for a card context.
- Conditionally render buttons based on status guards matching the domain entity's business rules.
- The same component is used on both the list page and the detail page — only the visual weight changes.

---

### Step 5 — Create Form Component (if needed)

File: `apps/webapp/src/components/{domain}/create-{entity}-form.tsx`

The form uses a toggle pattern — parent page shows/hides it via state. **All create forms MUST use `react-hook-form` + Zod resolver (Golden Rule #23a)** — raw `useState` form state is forbidden.

> **See also:** `webapp-form-with-validation` skill for the full field-by-field pattern, auth form examples, and common pitfalls.

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card, CardContent, CardHeader, CardTitle,
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
  Input, Select,
  toast,
} from '@mma/ui';
import { useCreate{Entity} } from '@mma/client-common';
import { create{Entity}Schema, {ENTITY}_ROLES, type Create{Entity}Input } from '@mma/contracts/{domain}';

export function Create{Entity}Form({ onClose }: { onClose: () => void }) {
  const create{Entity} = useCreate{Entity}();

  const form = useForm<Create{Entity}Input>({
    resolver: zodResolver(create{Entity}Schema),
    defaultValues: {
      // ... one key per schema field with an empty/default value
    },
  });

  const onSubmit = async (values: Create{Entity}Input) => {
    try {
      await create{Entity}.mutateAsync(values);
      toast.success('{Entity} created');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create {entity}';
      toast.error(message);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Create {Entity}</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            data-testid="create-{entity}-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="fieldName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Select example */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {{ENTITY}_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={create{Entity}.isPending}>
                {create{Entity}.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

**Rules:**
- **Never** use `useState` for form state — use `react-hook-form` + `zodResolver` always (Golden Rule #23a).
- Schema comes from `@mma/contracts/{domain}` — never define a form-specific Zod schema in the webapp.
- Wrap all fields in `<FormField>` → `<FormItem>` → `<FormControl>` → `<FormMessage>` for automatic `aria-invalid` / `aria-describedby` wiring.
- Always `<Form {...form}>` (spreads FormProvider context) wrapping the `<form>` element.
- Toast `success` on create; toast `error` on catch — never `alert()`, never silent.
- Use `grid gap-3 sm:grid-cols-2` layout for responsive form fields.
- `data-testid="create-{entity}-form"` on the `<form>` element (required by E2E selectors).

---

### Step 6 — Page Orchestrator

File: `apps/webapp/src/app/{domain}/page.tsx`

The page is a **thin orchestrator** (Golden Rule #19). It manages state and wires child components — it contains no table/form markup.

```typescript
'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button, Select } from '@mma/ui';
import { use{Entity}sByStatus } from '@mma/client-common';
import { {ENTITY}_STATUSES } from '@mma/contracts/{domain}';
import { Create{Entity}Form } from '@/components/{domain}/create-{entity}-form';
import { {Entity}sTable } from '@/components/{domain}/{domain}-table';

export default function {Entity}sPage() {
  const [status, setStatus] = useState<string>('{DEFAULT_STATUS}');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error } = use{Entity}sByStatus({
    {entity}Status: status,
  });

  return (
    <>
      <Header title="{Entity}s" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {{ENTITY}_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ New {Entity}'}
          </Button>
        </div>

        {showCreate && <Create{Entity}Form onClose={() => setShowCreate(false)} />}

        {isLoading && <p className="text-muted-foreground">Loading {entity}s...</p>}
        {isError && <p className="text-destructive">{error.message}</p>}

        {data && <{Entity}sTable {entity}s={data.data} />}
      </div>
    </>
  );
}
```

**Rules:**
- Always `'use client'` — pages that use hooks must be client components.
- Always `export default function` — Next.js App Router requires default exports for pages.
- Status filter uses `{ENTITY}_STATUSES` constant array from contracts.
- The page renders `<Header>` as the first element.
- Outer wrapper is `<div className="p-6 space-y-4">`.
- Loading/error/data rendering follows the `isLoading` / `isError` / `data` pattern.
- For **cursor-based pagination** (DynamoDB domains): `data.data` is the items array.
- For **offset-based pagination** (Prisma domains): `data.data` is the items array, plus render `data.page`, `data.totalPages`, `data.total`.

---

### Step 7 — Sidebar Navigation

File: `apps/webapp/src/components/layout/sidebar.tsx`

Add the new page to the `navItems` array:

```typescript
const navItems = [
  // ... existing items
  { href: '/{domain}', label: '{Entity}s', icon: '📋' },
];
```

**Rules:**
- `href` uses the kebab-case route path (e.g. `/orders`, `/products`).
- `label` is the human-readable plural name.
- Place the new entry after existing items, before any settings/utility links.
- The sidebar `isActive` logic handles nested routes automatically — `/orders` will match `/orders/123`.

---

### Step 8 — Detail Page + Details Card (if entity has a detail view)

A detail page is where users drill into a single entity. Follow the same thin-orchestrator rule: the page is ~25 lines; all markup lives in a `{Entity}DetailsCard` component.

**Files to create:**
- `apps/webapp/src/app/(protected)/{domain}/[{entity}Id]/page.tsx` — thin orchestrator
- `apps/webapp/src/components/{domain}/{entity}-details-card.tsx` — read/inline-edit card

#### Detail page

```typescript
'use client';

import { use } from 'react';
import { Header } from '@/components/layout/header';
import { use{Entity} } from '@mma/client-common';
import { {Entity}DetailsCard } from '@/components/{domain}/{entity}-details-card';
import { {Entity}Actions } from '@/components/{domain}/{entity}-actions';

export default function {Entity}DetailPage({
  params,
}: {
  params: Promise<{ {entity}Id: string }>;
}) {
  const { {entity}Id } = use(params);
  const { data: {entity}, isLoading, isError, error } = use{Entity}({entity}Id);

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading...</p>;
  if (isError) return <p className="p-6 text-destructive">{error.message}</p>;
  if (!{entity}) return <p className="p-6">Not found</p>;

  return (
    <>
      <Header title={{entity}.name} />
      <div className="p-6 space-y-4 max-w-2xl">
        <{Entity}DetailsCard {entity}={{entity}} />
        <{Entity}Actions {entity}={{entity}} variant="detail" />
      </div>
    </>
  );
}
```

#### Details card

The details card shows a read view, optionally with inline edit fields using RHF (see `webapp-form-with-validation` skill for the edit form pattern):

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@mma/ui';
import { format{Entity}Status } from '@mma/client-common';
import { {entity}StatusVariant } from '@/lib/status-variants';
import { Badge } from '@mma/ui';
import type { {Entity}Response } from '@mma/contracts/{domain}';

export function {Entity}DetailsCard({ {entity} }: { {entity}: {Entity}Response }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {/* Primary identifier */}
          <Badge variant={{entity}StatusVariant({entity}.status)}>
            {format{Entity}Status({entity}.status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* Read-only fields */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Field</p>
          <p className="text-sm">{/* value */}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Rules:**
- Detail page uses `use(params)` (React 19) to unwrap the `params` Promise — do not `await` in a client component.
- `use{Entity}(id)` is the single query hook; pass `id` from unwrapped params.
- The page renders `<{Entity}DetailsCard>` for data display and `<{Entity}Actions variant="detail">` for actions.
- The detail card uses `<Card>` with `<CardContent className="grid gap-4 sm:grid-cols-2">` for a two-column layout.
- If inline editing is needed, embed a secondary RHF form inside `{Entity}DetailsCard` (follow `webapp-form-with-validation` skill for the update form pattern).
- Link from the list table to the detail page: `<TableCell><Link href={`/{domain}/${entity.{entity}Id}`}>…</Link></TableCell>`.

---

## Offset-Based Pagination (Prisma Domains)

If the domain uses Prisma (offset-based pagination), the page response includes `page`, `totalPages`, and `total`. Add pagination controls below the table:

```typescript
{data && (
  <>
    <{Entity}sTable {entity}s={data.data} />
    <div className="text-sm text-muted-foreground">
      Page {data.page} of {data.totalPages} ({data.total} total)
    </div>
  </>
)}
```

For full pagination with prev/next buttons, add page state:

```typescript
const [page, setPage] = useState(1);
const { data } = use{Entity}sByStatus({ {entity}Status: status, page });
```

---

## Quick Reference: Which Files Are Affected

| Change type | Files |
|---|---|
| New domain list page | `app/(protected)/{domain}/page.tsx`, `components/{domain}/` (3-4 files), `lib/status-variants.ts`, `components/layout/sidebar.tsx` |
| New domain detail page | `app/(protected)/{domain}/[{entity}Id]/page.tsx`, `components/{domain}/{entity}-details-card.tsx` (reuses existing `{entity}-actions.tsx`) |
| New column in table | `components/{domain}/{domain}-table.tsx` only |
| New action button | `components/{domain}/{entity}-actions.tsx` + possibly a new mutation hook |
| New status value | `lib/status-variants.ts` (add case to variant mapper) |
| New form field | `components/{domain}/create-{entity}-form.tsx` only |

---

## Common Mistakes to Avoid

- **Putting table/form markup in the page** — the page is a thin orchestrator. All markup lives in domain components.
- **Using raw HTML `<table>` or `<button>`** — always use `@mma/ui` primitives.
- **Using `useState` for form state** — always use `react-hook-form` + `zodResolver` (Golden Rule #23a). `useState` forms bypass Zod validation, ARIA wiring, and toast feedback.
- **Using raw `<label>`** — always use `<FormLabel>` inside `<FormField>` (Golden Rule #21).
- **Hardcoding status strings** — always use `{Entity}StatusEnum.VALUE` from `@mma/contracts/{domain}`.
- **Hardcoding palette colors** — use semantic tokens (`text-success-text`, `text-destructive`) never `text-green-600` etc. (Golden Rule #23j).
- **Calling `fetch()` directly** — always use React Query hooks from `@mma/client-common`.
- **Forgetting `'use client'`** — pages and components that use hooks or state must be client components.
- **Forgetting to add the page to the sidebar** — check `sidebar.tsx` after creating a new page route.
- **Mixing pagination styles** — DynamoDB domains use cursor-based; Prisma domains use offset-based. Check which your domain uses.
