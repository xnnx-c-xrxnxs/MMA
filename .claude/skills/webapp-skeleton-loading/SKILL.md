---
name: webapp-skeleton-loading
description: Use the `<Skeleton>` primitive and shared loading shells (`<TableSkeleton>`, domain detail skeletons) when a page or component is waiting on async data. Use this when adding a new page's `loading.tsx`, when conditionally rendering data in a domain component, or when introducing a new list/detail surface.
---

# Skeleton Loading

`<Skeleton>` is a thin animated placeholder primitive in `@old-st/ui`. Combine it into shape-specific loaders for each surface.

Source: `packages/ui/src/components/data-display/skeleton/skeleton.tsx`.

Reusable shells:
- `apps/webapp/src/components/layout/table-skeleton.tsx` — `<TableSkeleton>` for list pages.

---

## Required Information — Ask First

1. **What surface is loading?** (list/table, detail card, form section, header)
2. **Is this used by `loading.tsx` (route segment)** or **conditionally inside a component** (after `isLoading` from React Query)?

---

## Standard Patterns

### Table / list page

Reuse `<TableSkeleton>` directly:

```tsx
// apps/webapp/src/app/(protected)/{domain}/loading.tsx
import { TableSkeleton } from '@/components/layout/table-skeleton';

export default function {Domain}Loading() {
  return <TableSkeleton />;
}
```

### Detail page

Build a shape-specific skeleton in `components/{domain}/{entity}-detail-skeleton.tsx`:

```tsx
import { Skeleton, Card, CardContent, CardHeader } from '@old-st/ui';

export function UserDetailSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}
```

### Conditional skeleton inside a component

```tsx
const { data, isLoading } = useUser(userId);
if (isLoading) return <UserDetailSkeleton />;
if (!data) return null;
return <UserDetailCard user={data} />;
```

---

## Rules

1. **Match the shape of the real content.** A skeleton for a 3-column table has 3 columns. A skeleton for a heading + 2 lines of body text has 1 large bar + 2 short bars. Do not use a generic spinner instead of a skeleton.
2. **Skeletons go in `apps/webapp/src/components/{domain}/{entity}-*-skeleton.tsx`** when domain-specific. Generic shells go in `apps/webapp/src/components/layout/`.
3. **`loading.tsx` files are Server Components** by default — don't add `'use client'` unless the skeleton itself is a client component.
4. **Use semantic Tailwind sizes** — `h-4` (text line), `h-6` (small heading), `h-8` (page title), `h-10` (input/row), `h-64` (large card).
5. **Never use a full-page spinner.** It hides the page structure and feels slower. Skeletons preserve perceived structure and feel faster than spinners.
6. **Don't over-animate.** `<Skeleton>` already pulses via `animate-pulse`. Don't add additional animations on top.

---

## When NOT to Use a Skeleton

- The data is in cache and `isLoading` is `false` from the first render — show data directly.
- The action is a mutation (use disabled button + toast, not skeleton).
- The page is mostly static and only one block is loading — a small inline `<Skeleton>` next to that block is fine, but don't replace the whole page.

---

## Tests

Skeletons are visual — they don't need unit tests. Verify they exist via E2E:

```ts
test('shows skeleton while users load', async ({ page }) => {
  await page.route('**/api/users**', (route) => new Promise(() => {})); // hang
  await page.goto('/users');
  await expect(page.getByTestId('users-skeleton')).toBeVisible();
});
```

(Add `data-testid="{domain}-skeleton"` to the wrapping element when you need to assert on it.)
