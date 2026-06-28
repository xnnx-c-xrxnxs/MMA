/**
 * User Repository Interface
 * Defines the contract for user data access operations
 */

import { IPaginatedResponse } from '@old-st/common';
import { UserRole, UserStatus } from '../../domain/constants';
import { User } from '../../domain/entities';

export abstract class IUserRepository {
  /**
   * Save a user entity (create or update)
   * Entity state (userId null vs set) determines insert vs upsert
   */
  abstract save(user: User): Promise<User>;

  /**
   * Find user by ID
   */
  abstract findById(userId: string): Promise<User | null>;

  /**
   * Find user by email
   */
  abstract findByEmail(email: string): Promise<User | null>;

  /**
   * List users by status with cursor-based pagination
   */
  abstract listByStatus(
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>>;

  /**
   * List users by role and status with cursor-based pagination
   */
  abstract listByRoleAndStatus(
    userRole: UserRole,
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>>;

}
