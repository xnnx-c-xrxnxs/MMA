---
name: webapp-error-boundaries
description: Add or update App Router error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) and segment loading states (`loading.tsx`) for the webapp. Use this when adding a new route segment, when a page can throw a recoverable error, or when introducing async data fetching that should show a skeleton.
---

# Webapp Error & Loading Boundaries

App Router special files implemented in this codebase:
- `apps/webapp/src/app/global-error.tsx` — root fallback (replaces the entire shell).
- `apps/webapp/src/app/not-found.tsx` — 404 page.
- `apps/webapp/src/app/loading.tsx` — default segment loading.
- `apps/webapp/src/app/(protected)/{domain}/error.tsx` — per-segment error.
- `apps/webapp/src/app/(protected)/{domain}/loading.tsx` — per-segment loading.

Reusable helpers:
- `apps/webapp/src/components/layout/segment-error.tsx` (`<SegmentError>`).
- `apps/webapp/src/components/layout/table-skeleton.tsx` (`<TableSkeleton>`).

---

## Required Information — Ask First

1. **What is the new route segment?** (`/users`, `/users/[userId]`, ...)
2. **Does it need a custom error fallback** beyond the shared `<SegmentError>`? (Usually no.)
3. **Does it need a custom loading skeleton** beyond `<TableSkeleton>`? (Yes for detail pages, no for list pages.)

---

## Files to Add Per New Route Segment

### `error.tsx` (always)

```tsx
'use client';

import { SegmentError } from '@/components/layout/segment-error';

export default function {Domain}Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError title="{Domain}" {...props} />;
}
```

### `loading.tsx` (when the page does its own data fetching)

```tsx
import { TableSkeleton } from '@/components/layout/table-skeleton';

export default function {Domain}Loading() {
  return <TableSkeleton />;
}
```

For detail pages, write a domain-specific skeleton in `components/{domain}/{entity}-detail-skeleton.tsx` and use it here.

---

## Rules

1. **Every route segment under `(protected)/` has both `error.tsx` and `loading.tsx`.** No exceptions for "trivial" pages — errors anywhere bubble up.
2. **`error.tsx` is always `'use client'`.** App Router requires it.
3. **`loading.tsx` is a Server Component by default.** Don't add `'use client'` unless you need it.
4. **Never reach for `try/catch` inside a page** to handle render errors. Throw and let the boundary catch.
5. **`global-error.tsx` is a special boundary that replaces the root layout.** It must include its own `<html>` + `<body>` tags. Do not use `<SegmentError>` inside it.
6. **`not-found.tsx` is rendered for `notFound()` calls and unmatched routes.** Keep it accessible (use `<Link>`, not raw `<a>`).
7. **The `error.digest` on the props is a server-side log correlation ID.** Display it in the UI (so users can quote it in support requests). The actual stack is server-only and never leaks to the client.

---

## Anti-Patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| One global `error.tsx` and no per-segment ones | Errors bubble too far — the entire shell remounts | Add per-segment `error.tsx` |
| `loading.tsx` in pages that don't fetch | Adds an unnecessary loading flash | Skip `loading.tsx` if the page is fully static |
| Catching errors with `try/catch` in the component body to set local error state | Bypasses the boundary — error never reaches Next.js logging or `error.digest` | Throw and let the boundary handle it |
| Returning `null` from `error.tsx` | User sees a blank screen | Always show a recovery action (`reset()`) |
| Using `next/router` in `not-found.tsx` | Wrong router for App Router | Use `next/navigation` (already used by `<Link>`) |

---

## Tests

Boundaries are exercised in E2E tests, not unit tests. Add a Playwright spec that:
1. Navigates to the page.
2. Mocks the API to return 500.
3. Asserts the segment error UI renders, with a working "Try again" button.
