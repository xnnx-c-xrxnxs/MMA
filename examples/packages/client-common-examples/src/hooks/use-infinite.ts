'use client';

import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import type { PaginatedResponse, CursorPointer } from '@old-st/contracts/common';
import { userApiClient } from '../infrastructure/api-clients/user-api.client';
import { productApiClient } from '../infrastructure/api-clients/product-api.client';
import type { UserResponse } from '@old-st/contracts/user';
import type { ProductResponse } from '@old-st/contracts/product';

const USERS_KEY = 'users';
const PRODUCTS_KEY = 'products';

/**
 * Encode a cursor pointer object as an opaque string for the API.
 * The shape is decided by the backend; we just stringify the JSON we got back.
 */
function encodeCursor(pointer: CursorPointer | undefined): string | undefined {
  if (!pointer) return undefined;
  return JSON.stringify(pointer);
}

interface InfiniteParams {
  limit?: number;
}

/**
 * Cursor-paginated infinite query for users by status.
 *
 * @example
 * const q = useUsersByStatusInfinite({ userStatus: 'ACTIVE', limit: 50 });
 * const items = q.data?.pages.flatMap(p => p.data) ?? [];
 * // ...render items, then:
 * <button onClick={() => q.fetchNextPage()} disabled={!q.hasNextPage || q.isFetchingNextPage}>
 *   Load more
 * </button>
 */
export function useUsersByStatusInfinite(
  params: InfiniteParams & { userStatus: string },
) {
  const queryKey: QueryKey = [USERS_KEY, 'by-status', 'infinite', params];
  return useInfiniteQuery<PaginatedResponse<UserResponse>>({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      userApiClient.listByStatus({
        userStatus: params.userStatus,
        limit: params.limit,
        cursor: pageParam as string | undefined,
        direction: 'next',
      }),
    getNextPageParam: (lastPage) => encodeCursor(lastPage.nextCursorPointer),
  });
}

export function useUsersByRoleAndStatusInfinite(
  params: InfiniteParams & { userRole: string; userStatus: string },
) {
  const queryKey: QueryKey = [USERS_KEY, 'by-role-and-status', 'infinite', params];
  return useInfiniteQuery<PaginatedResponse<UserResponse>>({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      userApiClient.listByRoleAndStatus({
        userRole: params.userRole,
        userStatus: params.userStatus,
        limit: params.limit,
        cursor: pageParam as string | undefined,
        direction: 'next',
      }),
    getNextPageParam: (lastPage) => encodeCursor(lastPage.nextCursorPointer),
  });
}

export function useProductsByStatusInfinite(
  params: InfiniteParams & { status: string },
) {
  const queryKey: QueryKey = [PRODUCTS_KEY, 'by-status', 'infinite', params];
  return useInfiniteQuery<PaginatedResponse<ProductResponse>>({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      productApiClient.listByStatus({
        status: params.status,
        limit: params.limit,
        cursor: pageParam as string | undefined,
        direction: 'next',
      }),
    getNextPageParam: (lastPage) => encodeCursor(lastPage.nextCursorPointer),
  });
}

export function useProductsByCategoryInfinite(
  params: InfiniteParams & { categoryId: string },
) {
  const queryKey: QueryKey = [PRODUCTS_KEY, 'by-category', 'infinite', params];
  return useInfiniteQuery<PaginatedResponse<ProductResponse>>({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      productApiClient.listByCategory({
        categoryId: params.categoryId,
        limit: params.limit,
        cursor: pageParam as string | undefined,
        direction: 'next',
      }),
    getNextPageParam: (lastPage) => encodeCursor(lastPage.nextCursorPointer),
  });
}
