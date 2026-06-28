import { UpdateUserRoleUseCase, UpdateUserRoleInput } from './update-user-role.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError, InvalidUserRoleError } from '../../exceptions';
import {
  UserAlreadyHasRoleError,
  CannotChangeRoleOfDeletedUserError,
} from '../../../domain/exceptions';

describe('UpdateUserRoleUseCase', () => {
  let useCase: UpdateUserRoleUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const makeActiveUser = () =>
    User.reconstitute({
      userId: 'user-123',
      email: 'test@example.com',
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

    useCase = new UpdateUserRoleUseCase(mockUserRepository);
  });

  it('should update user role successfully', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const input: UpdateUserRoleInput = { userId: 'user-123', newRole: 'ADMIN' };

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.getUserRole()).toBe('ADMIN');
    expect(result).toBe(user);
  });

  it('should throw when userId is empty', async () => {
    await expect(useCase.execute({ userId: '', newRole: 'ADMIN' })).rejects.toThrow(
      'User ID is required',
    );
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw when role is not provided', async () => {
    // TypeScript guards this but the use case also validates at runtime
    await expect(
      useCase.execute({ userId: 'user-123', newRole: '' as never }),
    ).rejects.toThrow('Role is required');
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw when role is invalid', async () => {
    await expect(
      useCase.execute({ userId: 'user-123', newRole: 'SUPERUSER' as never }),
    ).rejects.toThrow(InvalidUserRoleError);
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw when user is not found', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: 'nonexistent', newRole: 'ADMIN' })).rejects.toThrow(UserNotFoundError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when user already has the specified role', async () => {
    // Arrange: user is already USER
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);

    await expect(useCase.execute({ userId: 'user-123', newRole: 'USER' })).rejects.toThrow(
      'User already has this role',
    );
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when changing role of deleted user', async () => {
    const deletedUser = User.reconstitute({
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      userRole: 'USER',
      userStatus: 'DELETED',
      data: {},
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockUserRepository.findById.mockResolvedValue(deletedUser);

    await expect(useCase.execute({ userId: 'user-123', newRole: 'ADMIN' })).rejects.toThrow(
      'Cannot change role of deleted user',
    );
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });
});
