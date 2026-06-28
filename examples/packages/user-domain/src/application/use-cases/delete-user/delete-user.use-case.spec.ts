import { DeleteUserUseCase } from './delete-user.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';
import { UserAlreadyDeletedError } from '../../../domain/exceptions';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;
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

    useCase = new DeleteUserUseCase(mockUserRepository);
  });

  it('should soft-delete an active user', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    // Act
    await useCase.execute('user-123');

    // Assert: entity was loaded, domain method was invoked, then persisted
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    // The use case returns the saved entity so callers can publish events post-delete
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.getUserStatus()).toBe('DELETED');
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

  it('should propagate domain error when user is already deleted', async () => {
    // Arrange: already DELETED
    const alreadyDeletedUser = User.reconstitute({
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
    mockUserRepository.findById.mockResolvedValue(alreadyDeletedUser);

    await expect(useCase.execute('user-123')).rejects.toThrow(UserAlreadyDeletedError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should return the deleted User entity on success', async () => {
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const result = await useCase.execute('user-123');

    expect(result).toBeInstanceOf(User);
    expect(result.getUserId()).toBe('user-123');
  });
});
