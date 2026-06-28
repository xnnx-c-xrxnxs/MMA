import { UpdateUserProfileUseCase, UpdateUserProfileInput } from './update-user-profile.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';
import { CannotUpdateDeletedUserError } from '../../../domain/exceptions';

describe('UpdateUserProfileUseCase', () => {
  let useCase: UpdateUserProfileUseCase;
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
      data: { country: 'US' },
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

    useCase = new UpdateUserProfileUseCase(mockUserRepository);
  });

  it('should update firstName and lastName when provided', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const input: UpdateUserProfileInput = {
      userId: 'user-123',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.getFirstName()).toBe('Jane');
    expect(savedEntity.getLastName()).toBe('Smith');
    expect(result).toBe(user);
  });

  it('should update data when provided', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const input: UpdateUserProfileInput = {
      userId: 'user-123',
      data: { country: 'CA' },
    };

    // Act
    await useCase.execute(input);

    // Assert
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.getData()).toEqual(expect.objectContaining({ country: 'CA' }));
  });

  it('should update both name and data when both are provided', async () => {
    // Arrange
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const input: UpdateUserProfileInput = {
      userId: 'user-123',
      firstName: 'Jane',
      data: { country: 'GB' },
    };

    // Act
    await useCase.execute(input);

    // Assert
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.getFirstName()).toBe('Jane');
    expect(savedEntity.getData()).toEqual(expect.objectContaining({ country: 'GB' }));
  });

  it('should not call save when no profile fields are changed', async () => {
    // Arrange: input provides neither name nor data
    const user = makeActiveUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    const input: UpdateUserProfileInput = { userId: 'user-123' };

    // Act
    await useCase.execute(input);

    // Assert: save is still called (entity is persisted even if unchanged)
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw when userId is empty', async () => {
    const input: UpdateUserProfileInput = { userId: '' };

    await expect(useCase.execute(input)).rejects.toThrow('User ID is required');
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw when user is not found', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: 'nonexistent' })).rejects.toThrow(UserNotFoundError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when updating a deleted user', async () => {
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

    await expect(
      useCase.execute({ userId: 'user-123', firstName: 'Jane' }),
    ).rejects.toThrow(CannotUpdateDeletedUserError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });
});
