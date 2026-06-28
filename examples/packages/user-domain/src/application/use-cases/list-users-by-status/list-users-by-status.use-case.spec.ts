import { ListUsersByStatusUseCase, ListUsersByStatusInput } from './list-users-by-status.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';
import { InvalidUserStatusError } from '../../exceptions';

describe('ListUsersByStatusUseCase', () => {
  let useCase: ListUsersByStatusUseCase;
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
      userRole: 'USER',
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

    useCase = new ListUsersByStatusUseCase(mockUserRepository);
  });

  it('should return paginated users for a valid status', async () => {
    // Arrange
    const users = [makeUser('1'), makeUser('2')];
    const paginatedResult = makePaginatedResponse(users);
    mockUserRepository.listByStatus.mockResolvedValue(paginatedResult);

    const input: ListUsersByStatusInput = { status: 'ACTIVE' };

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(mockUserRepository.listByStatus).toHaveBeenCalledWith(
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
    mockUserRepository.listByStatus.mockResolvedValue(paginatedResult);

    const input: ListUsersByStatusInput = {
      status: 'PENDING',
      limit: 20,
      direction: 'next',
      nextCursorPointer: 'cursor-abc',
    };

    // Act
    await useCase.execute(input);

    // Assert
    expect(mockUserRepository.listByStatus).toHaveBeenCalledWith(
      'PENDING',
      20,
      'next',
      'cursor-abc',
      undefined,
    );
  });

  it('should throw when status is empty', async () => {
    const input = { status: '' as never };

    await expect(useCase.execute(input)).rejects.toThrow('Status is required');
    expect(mockUserRepository.listByStatus).not.toHaveBeenCalled();
  });

  it('should throw when status is invalid', async () => {
    const input = { status: 'SUSPENDED' as never };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidUserStatusError);
    expect(mockUserRepository.listByStatus).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.listByStatus.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute({ status: 'ACTIVE' })).rejects.toThrow(
      'Database connection failed',
    );
  });
});
