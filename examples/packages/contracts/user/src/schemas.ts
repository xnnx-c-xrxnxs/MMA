import { z } from 'zod';
import { USER_ROLES, USER_STATUSES, UserRoleEnum, UserStatusEnum } from '@old-st/user-domain';

// ============================================
// Enums - Re-exported from domain
// ============================================

// Re-export domain constants for convenience
export { USER_ROLES, USER_STATUSES, UserRoleEnum, UserStatusEnum };

// Zod schemas using domain constants
export const userRoleSchema = z.enum(USER_ROLES);
export const userStatusSchema = z.enum(USER_STATUSES);

// ============================================
// User Data Schema
// ============================================

export const userDataSchema = z.object({
  country: z.string().optional(),
});

// ============================================
// Create User Schema (API Input)
// ============================================

export const createUserSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  userRole: userRoleSchema.optional().default('USER'),
  data: userDataSchema.optional(),
});

// ============================================
// Update User Schema (API Input)
// ============================================

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  data: userDataSchema.optional(),
});

// ============================================
// User Response Schema (API Output)
// ============================================

export const userResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  userRole: userRoleSchema,
  userStatus: userStatusSchema,
  data: userDataSchema,
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Query Schemas
// ============================================

export const getUserByIdSchema = z.object({
  userId: z.string(),
});

export const getUserByEmailSchema = z.object({
  email: z.email(),
});

export const listUsersByRoleAndStatusSchema = z.object({
  userRole: userRoleSchema,
  userStatus: userStatusSchema,
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export const listUsersByStatusSchema = z.object({
  userStatus: userStatusSchema,
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

// ============================================
// Admin Actions
// ============================================

export const updateUserStatusSchema = z.object({
  userStatus: userStatusSchema,
});

export const updateUserRoleSchema = z.object({
  userRole: userRoleSchema,
});

// ============================================
// Type Exports (TypeScript Types)
// ============================================

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type UserData = z.infer<typeof userDataSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;
export type GetUserByEmailInput = z.infer<typeof getUserByEmailSchema>;
export type ListUsersByRoleAndStatusInput = z.infer<typeof listUsersByRoleAndStatusSchema>;
export type ListUsersByStatusInput = z.infer<typeof listUsersByStatusSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
