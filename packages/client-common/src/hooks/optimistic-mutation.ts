import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Generic helper for React Query optimistic updates.
 *
 * Handles the standard `onMutate` / `onError` / `onSettled` lifecycle:
 *   1. Cancel any outgoing refetches for the affected query.
 *   2. Snapshot the previous data.
 *   3. Apply the predicted update.
 *   4. On error, roll back to the snapshot.
 *   5. Always invalidate at the end so the truth comes from the server.
 *
 * Usage:
 *   useMutation({
 *     mutationFn: ...,
 *     ...optimisticMutation<TData, TInput>({
 *       queryClient,
 *       queryKey: [USERS_KEY, userId],
 *       update: (prev, input) => ({ ...prev, status: 'ACTIVE' }),
 *     }),
 *   });
 */
export interface OptimisticMutationOptions<TData, TInput> {
  queryClient: QueryClient;
  /** The query key whose cached data we want to update. */
  queryKey: QueryKey;
  /**
   * Pure update function. Receives the previous cached data (may be undefined
   * if the query hasn't loaded yet) and the mutation input. Return the new
   * cached value, or undefined to skip the optimistic write.
   */
  update: (previous: TData | undefined, input: TInput) => TData | undefined;
  /**
   * Additional query keys to invalidate on settle. Useful for list views that
   * derive from the same entity (e.g. by-status, by-role lists).
   */
  invalidateOnSettle?: QueryKey[];
}

interface OptimisticContext<TData> {
  previous: TData | undefined;
}

export function optimisticMutation<TData, TInput>(
  opts: OptimisticMutationOptions<TData, TInput>,
) {
  const { queryClient, queryKey, update, invalidateOnSettle = [] } = opts;
  return {
    onMutate: async (input: TInput): Promise<OptimisticContext<TData>> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TData>(queryKey);
      const next = update(previous, input);
      if (next !== undefined) {
        queryClient.setQueryData<TData>(queryKey, next);
      }
      return { previous };
    },
    onError: (_err: unknown, _input: TInput, ctx?: OptimisticContext<TData>) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData<TData>(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      for (const key of invalidateOnSettle) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  };
}
