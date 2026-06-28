import { VerifyUserEmailUseCase } from './verify-user-email.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';
import { EmailAlreadyVerifiedError } from '../../../domain/exceptions';

describe('VerifyUserEmailUseCase', () => {
  let useCase: VerifyUserEmailUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const makeUnverifiedUser = () =>
    User.reconstitute({
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

  beforeEach(() => {
    mockUserRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByStatus: jest.fn(),
      listByRoleAndStatus: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new VerifyUserEmailUseCase(mockUserRepository);
  });

  it('should verify email for an unverified user', async () => {
    // Arrange
    const user = makeUnverifiedUser();
    mockUserRepository.findById.mockResolvedValue(user);
    mockUserRepository.save.mockResolvedValue(user);

    // Act
    const result = await useCase.execute('user-123');

    // Assert
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    // Entity passed to save() should now have emailVerified = true
    const savedEntity = mockUserRepository.save.mock.calls[0][0] as User;
    expect(savedEntity.isEmailVerified()).toBe(true);
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

  it('should propagate domain error when email is already verified', async () => {
    const alreadyVerifiedUser = User.reconstitute({
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
    mockUserRepository.findById.mockResolvedValue(alreadyVerifiedUser);

    await expect(useCase.execute('user-123')).rejects.toThrow(EmailAlreadyVerifiedError);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute('user-123')).rejects.toThrow('Database connection failed');
  });
});
