/**
 * Common pagination interface for internal use across domain and infrastructure layers.
 * This is a type-only interface without validation - use for repository implementations.
 * 
 * For API responses, use the Zod schema from @old-st/contracts which provides validation.
 * 
 * Two pagination styles are supported:
 * - Cursor-based (IPaginatedResponse): Used by DynamoDB-backed domains (user, product)
 * - Offset-based (IOffsetPaginatedResponse): Used by Prisma/PostgreSQL-backed domains (order)
 */

// ─── Cursor-based pagination (DynamoDB domains) ─────────────────────────────

/**
 * Cursor pointer for pagination.
 * Contains the key-value pairs needed to resume from a specific position.
 */
export type CursorPointer = Record<string, unknown> | null;

/**
 * Generic cursor-based paginated response interface.
 * Used internally by DynamoDB-backed repositories and infrastructure.
 * 
 * @template T - The type of items in the data array
 */
export interface IPaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  
  /** Cursor to fetch the next page (null if no more pages) */
  nextCursorPointer: CursorPointer;
  
  /** Cursor to fetch the previous page (null if on first page) */
  prevCursorPointer: CursorPointer;
}

/**
 * Helper function to create a cursor-based paginated response.
 * Provides type safety and consistent structure.
 * 
 * @template T - The type of items in the data array
 * @param data - Array of items
 * @param nextCursor - Cursor for next page
 * @param prevCursor - Cursor for previous page
 * @returns Paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  nextCursor: CursorPointer = null,
  prevCursor: CursorPointer = null
): IPaginatedResponse<T> {
  return {
    data,
    nextCursorPointer: nextCursor,
    prevCursorPointer: prevCursor,
  };
}

// ─── Offset-based pagination (Prisma / PostgreSQL domains) ───────────────────

/**
 * Generic offset-based paginated response interface.
 * Used internally by Prisma-backed repositories and infrastructure.
 * 
 * @template T - The type of items in the data array
 */
export interface IOffsetPaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];

  /** Total number of matching records across all pages */
  total: number;

  /** Current page number (1-based) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Total number of pages */
  totalPages: number;
}

/**
 * Helper function to create an offset-based paginated response.
 * Provides type safety and consistent structure.
 * 
 * @template T - The type of items in the data array
 * @param data - Array of items for the current page
 * @param total - Total record count
 * @param page - Current page number (1-based)
 * @param limit - Page size
 * @returns Offset-paginated response object
 */
export function createOffsetPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): IOffsetPaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
