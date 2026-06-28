/**
 * CreateUser Use Case
 * Application layer - orchestrates user creation workflow
 */

import { IUseCase } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserRole, UserRoleEnum } from '../../../domain/constants';
import { EmailAlreadyExistsError } from '../../exceptions';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  userRole?: UserRole;
  data?: { country?: string };
}

export class CreateUserUseCase implements IUseCase<CreateUserInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: CreateUserInput): Promise<User> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new EmailAlreadyExistsError(input.email);
    }

    // Create domain entity (business validation happens here)
    const user = User.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      userRole: input.userRole || UserRoleEnum.USER,
      data: input.data,
    });

    // Persist and return entity
    return await this.userRepository.save(user);
  }
}

