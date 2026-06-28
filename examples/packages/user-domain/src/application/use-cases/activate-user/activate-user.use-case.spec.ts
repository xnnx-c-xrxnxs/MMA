import { ActivateUserUseCase } from './activate-user.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';
import {
  CannotActivateUnverifiedEmailError,
  CannotActivateNonPendingUserError,
} from '../../../domain/exceptions';

describe('ActivateUserUseCase', () => {
  let useCase: ActivateUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const makePendingVerifiedUser = () =>
    User.reconstitute({
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      userRole: 'USER',
      userStatus: 'PENDING',
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

    useCase = new ActivateUserUseCase(mockUserRepository);
  });

  it('should activate a pending user with verified email', async () => {
    // Arrange
    const user = makePendingVerifiedUser();
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

  it('should propagate domain error when email is not verified', async () => {
    // Arrange: user is PENDING but email is NOT verified
    const unverifiedUser = User.reconstitute({
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: false,
      userRole: 'USER',
      userStatus: 'PENDING',
      data: {},
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockUserRepository.findById.mockResolvedValue(unverifiedUser);

    await expect(useCase.execute('user-123')).rejects.toThrow(CannotActivateUnverifiedEmailError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when user is not in PENDING status', async () => {
    // Arrange: user is already ACTIVE
    const activeUser = User.reconstitute({
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
    mockUserRepository.findById.mockResolvedValue(activeUser);

    await expect(useCase.execute('user-123')).rejects.toThrow(CannotActivateNonPendingUserError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute('user-123')).rejects.toThrow('Database connection failed');
  });
});
