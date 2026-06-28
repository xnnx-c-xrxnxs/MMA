import { z } from 'zod';
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  CustomerStatusEnum,
  CustomerTierEnum,
} from '@mma/customer-domain';
import { PaginatedResponse } from '@mma/contracts/common';

// ── Re-export domain constants ──────────────────────────────────────────────
export { CUSTOMER_STATUSES, CUSTOMER_TIERS, CustomerStatusEnum, CustomerTierEnum };

// ── Enum schemas ─────────────────────────────────────────────────────────────
export const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
export const customerTierSchema = z.enum(CUSTOMER_TIERS);

// ── Create Input ─────────────────────────────────────────────────────────────
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  userId: z.string().optional(),
  company: z.string().max(160).optional(),
  tier: customerTierSchema.optional(),
});

// ── Update Input (name/company/tier only — email is immutable) ───────────────
export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  company: z.string().max(160).optional(),
  tier: customerTierSchema.optional(),
});

// ── Response Schema (API output) ─────────────────────────────────────────────
export const customerResponseSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  email: z.string(),
  userId: z.string().optional(),
  company: z.string().optional(),
  tier: customerTierSchema,
  customerStatus: customerStatusSchema,
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── Query Schemas — cursor-based pagination (DynamoDB domain) ────────────────
export const listCustomersByStatusSchema = z.object({
  status: customerStatusSchema,
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export const listCustomersByTierSchema = z.object({
  tier: customerTierSchema,
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

// ── Path Parameter Schemas ────────────────────────────────────────────────────
export const getCustomerByIdSchema = z.object({
  customerId: z.string(),
});

export const getCustomerByUserIdSchema = z.object({
  userId: z.string(),
});

// ── Paginated Response (cursor-based) ────────────────────────────────────────
export type CustomerListResponse = PaginatedResponse<CustomerResponse>;

// ── TypeScript Type Exports ───────────────────────────────────────────────────
export type CustomerStatus = z.infer<typeof customerStatusSchema>;
export type CustomerTier = z.infer<typeof customerTierSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerResponse = z.infer<typeof customerResponseSchema>;
export type ListCustomersByStatusInput = z.infer<
  typeof listCustomersByStatusSchema
>;
export type ListCustomersByTierInput = z.infer<
  typeof listCustomersByTierSchema
>;
export type GetCustomerByIdInput = z.infer<typeof getCustomerByIdSchema>;
export type GetCustomerByUserIdInput = z.infer<
  typeof getCustomerByUserIdSchema
>;
