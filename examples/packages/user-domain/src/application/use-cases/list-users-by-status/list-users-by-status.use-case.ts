/**
 * ListUsersByStatus Use Case
 * Lists users filtered by their status with cursor-based pagination
 */

import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { USER_STATUSES, UserStatus } from '../../../domain/constants';
import { User } from '../../../domain/entities';
import { InvalidInputError, InvalidUserStatusError } from '../../exceptions';

export interface ListUsersByStatusInput {
  status: UserStatus;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListUsersByStatusUseCase implements IUseCase<ListUsersByStatusInput, IPaginatedResponse<User>> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ListUsersByStatusInput): Promise<IPaginatedResponse<User>> {
    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }

    // Validate status
    if (!USER_STATUSES.includes(input.status)) {
      throw new InvalidUserStatusError(input.status);
    }

    return await this.userRepository.listByStatus(
      input.status,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
