---
name: webapp-cursor-infinite-scroll
description: Wire cursor-paginated lists into infinite scroll using the `useUsersByStatusInfinite`, `useProductsByStatusInfinite`, etc. hooks from `@old-st/client-common`. Use this when adding a new list view that loads more rows on scroll, or when migrating an existing paginated table to an infinite list.
---

# Webapp Cursor Infinite Scroll

Cursor-paginated DynamoDB-backed list endpoints (users, products) are exposed as `useInfiniteQuery`-based hooks in `@old-st/client-common/src/hooks/use-infinite.ts`. They:

- Pass `direction: 'next'` and a serialised cursor in `cursor` for each subsequent page.
- Encode the response's `nextCursorPointer` (an object) as a JSON string for the next request via `getNextPageParam`.
- Return the standard `useInfiniteQuery` shape: `data.pages[]`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`.

> **Prisma / offset-paginated domains (orders, payments) do not have infinite hooks.** They use page/limit and should stay paginated. If you need infinite scroll there, that requires a backend change to a cursor index — discuss before doing it.

## Available hooks

| Hook | Endpoint |
|---|---|
| `useUsersByStatusInfinite({ userStatus, limit })` | `GET /users/by-status` |
| `useUsersByRoleAndStatusInfinite({ userRole, userStatus, limit })` | `GET /users/by-role-and-status` |
| `useProductsByStatusInfinite({ status, limit })` | `GET /products/by-status` |
| `useProductsByCategoryInfinite({ categoryId, limit })` | `GET /products/by-category` |

## Minimal example

```tsx
'use client';
import { useUsersByStatusInfinite } from '@old-st/client-common';
import { Button } from '@old-st/ui';

export function UsersInfiniteList() {
  const q = useUsersByStatusInfinite({ userStatus: 'ACTIVE', limit: 50 });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div>
      <ul>
        {items.map((u) => (
          <li key={u.userId}>{u.firstName} {u.lastName}</li>
        ))}
      </ul>
      <Button
        onClick={() => q.fetchNextPage()}
        disabled={!q.hasNextPage || q.isFetchingNextPage}
      >
        {q.isFetchingNextPage ? 'Loading…' : q.hasNextPage ? 'Load more' : 'No more'}
      </Button>
    </div>
  );
}
```

## Auto-loading on scroll (intersection observer)

For pages where the user shouldn't have to click a button:

```tsx
import { useEffect, useRef } from 'react';

const sentinel = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!sentinel.current) return;
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  });
  obs.observe(sentinel.current);
  return () => obs.disconnect();
}, [q.hasNextPage, q.isFetchingNextPage]);

// At the bottom of the list:
<div ref={sentinel} />
```

## Choosing infinite vs paginated

| Use infinite when… | Use paginated when… |
|---|---|
| Mobile / touch UX | Desktop admin grid |
| Feed / activity stream | Bulk operations (export, delete-all) |
| List rarely needs random-access | User asks "show me page 5" |

## Backend expectations

The hook serialises the response's `nextCursorPointer` (object) to a JSON string and sends it as the `cursor` query param. If the API ever changes the cursor encoding, update `encodeCursor()` in `use-infinite.ts` and bump the integration tests.

## Adding a new infinite hook

When adding a new cursor-paginated endpoint:

1. Make sure the API client in `client-common/infrastructure/api-clients/` already exposes the underlying paginated method.
2. Append a new exported function to `packages/client-common/src/hooks/use-infinite.ts`:
   ```ts
   export function useThingByXInfinite(params: InfiniteParams & { x: string }) { … }
   ```
3. Re-export from `packages/client-common/src/hooks/index.ts` and `packages/client-common/src/index.ts`.
4. Add a unit test that spies on the API client and asserts the cursor is forwarded.
