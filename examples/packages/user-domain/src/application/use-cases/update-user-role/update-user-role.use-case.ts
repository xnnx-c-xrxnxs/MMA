/**
 * UpdateUserRole Use Case
 * Updates a user's role (admin action)
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { USER_ROLES, UserRole } from '../../../domain/constants';
import { InvalidInputError, UserNotFoundError, InvalidUserRoleError } from '../../exceptions';

export interface UpdateUserRoleInput {
  userId: string;
  newRole: UserRole;
}

export class UpdateUserRoleUseCase implements IUseCase<UpdateUserRoleInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateUserRoleInput): Promise<User> {
    if (!input.userId) {
      throw new InvalidInputError('User ID is required');
    }

    if (!input.newRole) {
      throw new InvalidInputError('Role is required');
    }

    // Validate role
    if (!USER_ROLES.includes(input.newRole)) {
      throw new InvalidUserRoleError(input.newRole);
    }

    // Load user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // Use domain method
    user.changeRole(input.newRole);

    // Persist state change
    return await this.userRepository.save(user);
  }
}
