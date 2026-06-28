/**
 * DeactivateUser Use Case
 * Deactivates a user account (admin action)
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class DeactivateUserUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }

    // Load user
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Use domain method
    user.deactivate();

    // Persist state change
    return await this.userRepository.save(user);
  }
}
