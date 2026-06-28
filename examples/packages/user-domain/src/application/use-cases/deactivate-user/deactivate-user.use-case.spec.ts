import { DeactivateUserUseCase } from './deactivate-user.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';
import {
  UserAlreadyInactiveError,
  CannotDeactivateDeletedUserError,
} from '../../../domain/exceptions';

describe('DeactivateUserUseCase', () => {
  let useCase: DeactivateUserUseCase;
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

    useCase = new DeactivateUserUseCase(mockUserRepository);
  });

  it('should deactivate an active user', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    // Act
    const result = await useCase.execute('user-123');

    // Assert
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    expect(result).toBe(user);
  });

  it('should throw when userId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow('User ID is required');
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw when user is not found', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent')).rejects.toThrow(UserNotFoundError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when user is already inactive', async () => {
    // Arrange: already INACTIVE
    const inactiveUser = User.reconstitute({
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      userRole: 'USER',
      userStatus: 'INACTIVE',
      data: {},
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockUserRepository.findById.mockResolvedValue(inactiveUser);

    await expect(useCase.execute('user-123')).rejects.toThrow(UserAlreadyInactiveError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when user is deleted', async () => {
    // Arrange: DELETED user
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

    await expect(useCase.execute('user-123')).rejects.toThrow(CannotDeactivateDeletedUserError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute('user-123')).rejects.toThrow('Database connection failed');
  });
});
