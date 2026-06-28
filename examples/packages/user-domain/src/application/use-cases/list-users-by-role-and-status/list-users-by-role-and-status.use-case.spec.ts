import {
  ListUsersByRoleAndStatusUseCase,
  ListUsersByRoleAndStatusInput,
} from './list-users-by-role-and-status.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';
import { InvalidUserRoleError, InvalidUserStatusError } from '../../exceptions';

describe('ListUsersByRoleAndStatusUseCase', () => {
  let useCase: ListUsersByRoleAndStatusUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const makePaginatedResponse = (users: User[]): IPaginatedResponse<User> => ({
    data: users,
    nextCursorPointer: null,
    prevCursorPointer: null,
  });

  const makeUser = (userId: string) =>
    User.reconstitute({
      userId,
      email: `user-${userId}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      userRole: 'ADMIN',
      userStatus: 'ACTIVE',
      data: {},
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

  beforeEach(() => {
    mockUserRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByStatus: jest.fn(),
      listByRoleAndStatus: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new ListUsersByRoleAndStatusUseCase(mockUserRepository);
  });

  it('should return paginated users for a valid role and status', async () => {
    // Arrange
    const users = [makeUser('1'), makeUser('2')];
    const paginatedResult = makePaginatedResponse(users);
    mockUserRepository.listByRoleAndStatus.mockResolvedValue(paginatedResult);

    const input: ListUsersByRoleAndStatusInput = { role: 'ADMIN', status: 'ACTIVE' };

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(mockUserRepository.listByRoleAndStatus).toHaveBeenCalledWith(
      'ADMIN',
      'ACTIVE',
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toBe(paginatedResult);
    expect(result.data).toHaveLength(2);
  });

  it('should pass pagination parameters to repository', async () => {
    // Arrange
    const paginatedResult = makePaginatedResponse([]);
    mockUserRepository.listByRoleAndStatus.mockResolvedValue(paginatedResult);

    const input: ListUsersByRoleAndStatusInput = {
      role: 'USER',
      status: 'PENDING',
      limit: 10,
      direction: 'next',
      nextCursorPointer: 'cursor-xyz',
    };

    // Act
    await useCase.execute(input);

    // Assert
    expect(mockUserRepository.listByRoleAndStatus).toHaveBeenCalledWith(
      'USER',
      'PENDING',
      10,
      'next',
      'cursor-xyz',
      undefined,
    );
  });

  it('should throw when role is empty', async () => {
    const input = { role: '' as never, status: 'ACTIVE' as const };

    await expect(useCase.execute(input)).rejects.toThrow('Role is required');
    expect(mockUserRepository.listByRoleAndStatus).not.toHaveBeenCalled();
  });

  it('should throw when status is empty', async () => {
    const input = { role: 'USER' as const, status: '' as never };

    await expect(useCase.execute(input)).rejects.toThrow('Status is required');
    expect(mockUserRepository.listByRoleAndStatus).not.toHaveBeenCalled();
  });

  it('should throw when role is invalid', async () => {
    const input = { role: 'SUPERUSER' as never, status: 'ACTIVE' as const };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidUserRoleError);
    expect(mockUserRepository.listByRoleAndStatus).not.toHaveBeenCalled();
  });

  it('should throw when status is invalid', async () => {
    const input = { role: 'USER' as const, status: 'SUSPENDED' as never };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidUserStatusError);
    expect(mockUserRepository.listByRoleAndStatus).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.listByRoleAndStatus.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(
      useCase.execute({ role: 'USER', status: 'ACTIVE' }),
    ).rejects.toThrow('Database connection failed');
  });
});
