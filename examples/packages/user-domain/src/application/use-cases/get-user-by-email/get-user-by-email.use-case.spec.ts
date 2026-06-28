import { GetUserByEmailUseCase } from './get-user-by-email.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';

describe('GetUserByEmailUseCase', () => {
  let useCase: GetUserByEmailUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const makeUser = () =>
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

    useCase = new GetUserByEmailUseCase(mockUserRepository);
  });

  it('should return user when found by email', async () => {
    // Arrange
    const user = makeUser();
    mockUserRepository.findByEmail.mockResolvedValue(user);

    // Act
    const result = await useCase.execute('test@example.com');

    // Assert
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(result).toBe(user);
  });

  it('should throw UserNotFoundError when user is not found', async () => {
    // Arrange
    mockUserRepository.findByEmail.mockResolvedValue(null);

    // Act & Assert
    await expect(useCase.execute('unknown@example.com')).rejects.toThrow(UserNotFoundError);
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('unknown@example.com');
  });

  it('should throw when email is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow('Email is required');
    expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.findByEmail.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute('test@example.com')).rejects.toThrow('Database connection failed');
  });
});
