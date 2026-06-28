/**
 * API Pagination Schemas with Zod Validation
 * 
 * These schemas are used for API responses and provide runtime validation.
 * For internal repository/infrastructure use, see @mma/common interfaces.
 * 
 * Architecture Guidelines:
 * - Controllers/API Layer → Use these Zod schemas (with validation)
 * - Repositories/Infrastructure → Use @mma/common interfaces (type-only)
 * - Application Services → Transform between common interfaces and validated DTOs
 * 
 * Two pagination styles are supported:
 * - Cursor-based (PaginatedResponse): Used by DynamoDB-backed domains (user, product)
 * - Offset-based (OffsetPaginatedResponse): Used by Prisma/PostgreSQL-backed domains (order)
 */

import { z } from 'zod';

// ─── Cursor-based pagination (DynamoDB domains) ─────────────────────────────

/**
 * Pagination cursor pointer schema
 * Used for DynamoDB cursor-based pagination in API responses
 */
export const cursorPointerSchema = z.record(z.string(), z.unknown()).nullable();

/**
 * Generic cursor-based paginated response schema for API validation
 * Used for all cursor-paginated API responses with runtime validation
 * 
 * @param dataSchema - Zod schema for the items in the data array
 * @returns Validated paginated response schema
 */
export const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    nextCursorPointer: cursorPointerSchema.optional(),
    prevCursorPointer: cursorPointerSchema.optional(),
  });

export type CursorPointer = z.infer<typeof cursorPointerSchema>;

export type PaginatedResponse<T> = {
  data: T[];
  nextCursorPointer?: CursorPointer;
  prevCursorPointer?: CursorPointer;
};

/**
 * Helper function to create and validate cursor-based paginated API response
 * Use this in Application Services when transforming DynamoDB repository results to DTOs
 */
export function createPaginatedResponse<T>(
  data: T[],
  nextCursorPointer?: CursorPointer,
  prevCursorPointer?: CursorPointer
): PaginatedResponse<T> {
  return {
    data,
    ...(nextCursorPointer !== undefined && { nextCursorPointer }),
    ...(prevCursorPointer !== undefined && { prevCursorPointer }),
  };
}

// ─── Offset-based pagination (Prisma / PostgreSQL domains) ───────────────────

/**
 * Generic offset-based paginated response schema for API validation
 * Used for Prisma-backed paginated API responses
 * 
 * @param dataSchema - Zod schema for the items in the data array
 * @returns Validated offset-paginated response schema
 */
export const offsetPaginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

export type OffsetPaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Helper function to create an offset-based paginated API response
 * Use this in Application Services when transforming Prisma repository results to DTOs
 */
export function createOffsetPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): OffsetPaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
