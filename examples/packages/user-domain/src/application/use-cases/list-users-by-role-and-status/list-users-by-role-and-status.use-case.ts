/**
 * ListUsersByRoleAndStatus Use Case
 * Lists users filtered by role and status with cursor-based pagination
 */

import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { USER_ROLES, USER_STATUSES, UserRole, UserStatus } from '../../../domain/constants';
import { User } from '../../../domain/entities';
import { InvalidInputError, InvalidUserRoleError, InvalidUserStatusError } from '../../exceptions';

export interface ListUsersByRoleAndStatusInput {
  role: UserRole;
  status: UserStatus;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListUsersByRoleAndStatusUseCase implements IUseCase<ListUsersByRoleAndStatusInput, IPaginatedResponse<User>> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ListUsersByRoleAndStatusInput): Promise<IPaginatedResponse<User>> {
    if (!input.role) {
      throw new InvalidInputError('Role is required');
    }

    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }

    // Validate role and status
    if (!USER_ROLES.includes(input.role)) {
      throw new InvalidUserRoleError(input.role);
    }

    if (!USER_STATUSES.includes(input.status)) {
      throw new InvalidUserStatusError(input.status);
    }

    return await this.userRepository.listByRoleAndStatus(
      input.role,
      input.status,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
