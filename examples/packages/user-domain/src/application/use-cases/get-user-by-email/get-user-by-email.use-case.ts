/**
 * GetUserByEmail Use Case
 * Retrieves a user by their email address
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class GetUserByEmailUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string): Promise<User> {
    if (!email) {
      throw new InvalidInputError('Email is required');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UserNotFoundError(email);
    }
    return user;
  }
}
