/**
 * UpdateUserProfile Use Case
 * Updates user profile information (firstName, lastName, data)
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export interface UpdateUserProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  data?: { country?: string };
}

export class UpdateUserProfileUseCase implements IUseCase<UpdateUserProfileInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<User> {
    if (!input.userId) {
      throw new InvalidInputError('User ID is required');
    }

    // Verify user exists
    const existingUser = await this.userRepository.findById(input.userId);
    if (!existingUser) {
      throw new UserNotFoundError(input.userId);
    }

    // Apply changes through domain methods (enforces business rules)
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const firstName = input.firstName ?? existingUser.getFirstName();
      const lastName = input.lastName ?? existingUser.getLastName();
      existingUser.updateProfile(firstName, lastName);
    }

    if (input.data !== undefined) {
      existingUser.updateData(input.data);
    }

    // Persist updated entity
    return await this.userRepository.save(existingUser);
  }
}
