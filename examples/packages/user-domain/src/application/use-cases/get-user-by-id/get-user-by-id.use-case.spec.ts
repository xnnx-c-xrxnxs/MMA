import { GetUserByIdUseCase } from './get-user-by-id.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';

describe('GetUserByIdUseCase', () => {
  let useCase: GetUserByIdUseCase;
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

    useCase = new GetUserByIdUseCase(mockUserRepository);
  });

  it('should return user when found', async () => {
    // Arrange
    const user = makeUser();
    mockUserRepository.findById.mockResolvedValue(user);

    // Act
    const result = await useCase.execute('user-123');

    // Assert
    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    expect(result).toBe(user);
  });

  it('should throw UserNotFoundError when user is not found', async () => {
    // Arrange
    mockUserRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(useCase.execute('nonexistent')).rejects.toThrow(UserNotFoundError);
    expect(mockUserRepository.findById).toHaveBeenCalledWith('nonexistent');
  });

  it('should throw when userId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow('User ID is required');
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

    await expect(useCase.execute('user-123')).rejects.toThrow('Database connection failed');
  });
});
