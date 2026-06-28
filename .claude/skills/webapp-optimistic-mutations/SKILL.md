---
name: webapp-optimistic-mutations
description: Apply optimistic updates to React Query mutations using the `optimisticMutation` helper from `@mma/client-common` or hand-rolled `onMutate`/`onError`/`onSettled`. Use this when a mutation should make the UI feel instant (status toggles, like buttons, inline edits) and rollback if the API rejects.
---

# Webapp Optimistic Mutations

Optimistic updates make a mutation appear to succeed instantly by patching the React Query cache **before** the network call returns, then either keeping the patched value (success) or rolling back (error). Use them sparingly — only when the round-trip latency hurts UX.

Source: `packages/client-common/src/hooks/optimistic-mutation.ts`.

## When to apply

| ✅ Good fit | ❌ Bad fit |
|---|---|
| Status toggles (`activate`, `deactivate`, `verify-email`) | Operations that may fail server-side validation often (rollback feels worse than waiting) |
| Like / star / favourite buttons | Mutations whose response carries server-derived data (timestamps, generated IDs) |
| Inline edits with predictable result | Workflow-changing operations (`confirm-order`, `process-payment`) |
| Anything < 1s perceived latency benefit | Background mutations the user didn't initiate |

## The helper (static query key)

`optimisticMutation` is a small factory returning `{ onMutate, onError, onSettled }`. Spread it into `useMutation`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { optimisticMutation } from '@mma/client-common';

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productApiClient.toggleFavorite(productId),
    ...optimisticMutation<ProductResponse, string>({
      queryClient,
      queryKey: ['products', 'favorites'],
      update: (previous, productId) => {
        if (!previous) return undefined;
        return { ...previous, favorited: !previous.favorited };
      },
    }),
  });
}
```

`update` returns the next cache value, or `undefined` to skip writing.

## The hand-rolled pattern (input-derived query key)

When the cache key depends on the input (e.g. `['users', userId]`), spreading the helper doesn't apply. Use the same shape directly:

```ts
export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userApiClient.activate(userId),
    onMutate: async (userId: string) => {
      const detailKey = ['users', userId];
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<UserResponse>(detailKey);
      if (previous) {
        queryClient.setQueryData<UserResponse>(detailKey, {
          ...previous,
          status: USER_STATUSES.ACTIVE,
        });
      }
      return { previous, detailKey };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.previous && ctx.detailKey) {
        queryClient.setQueryData(ctx.detailKey, ctx.previous);
      }
    },
    onSettled: (_data, _err, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'by-status'] });
    },
  });
}
```

This is the actual implementation in `use-users.ts` — copy this template for new domains.

## Required toast pairing

Pair every optimistic mutation with a toast on **error** so the user understands the rollback:

```tsx
const activate = useActivateUser();

await activate.mutateAsync(userId).catch((err) => {
  toast.error(`Failed to activate user: ${err.message}`);
});
```

Success toasts are optional (the UI already updated).

## Cache invalidation strategy

Always invalidate the **detail key** + any **derived list views** in `onSettled` (success or error). The list views (`['users', 'by-status']`, `['users', 'by-role-and-status']`) re-fetch with the authoritative data so any drift is corrected.

## Don't over-apply

If a page only renders the detail view, optimistic update is overkill — `useMutation`'s default behaviour with `onSuccess: () => invalidateQueries(...)` is fine. Save optimism for surfaces where the latency is visible (lists, toggles in dense grids).
