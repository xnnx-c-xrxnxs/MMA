/**
 * DeleteUser Use Case
 * Soft deletes a user (sets status to DELETED)
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class DeleteUserUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }

    // Load entity so domain rules are enforced
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Domain method enforces: cannot delete an already-deleted user
    user.markAsDeleted();

    // Persist state change and return entity for downstream use (e.g. event publishing)
    return await this.userRepository.save(user);
  }
}
