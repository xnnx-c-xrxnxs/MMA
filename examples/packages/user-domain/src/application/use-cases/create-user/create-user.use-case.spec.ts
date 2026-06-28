import { CreateUserUseCase } from './create-user.use-case';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { EmailAlreadyExistsError } from '../../exceptions';
import { InvalidEmailFormatError } from '../../../domain/exceptions';

/**
 * Unit Tests for CreateUserUseCase (Application Layer)
 * Testing use case orchestration with mocked dependencies
 */
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByStatus: jest.fn(),
      listByRoleAndStatus: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new CreateUserUseCase(mockUserRepository);
  });

  it('should create a new user successfully', async () => {
    // Arrange
    const input = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      userRole: 'USER' as const,
    };

    // Mock: Email doesn't exist
    mockUserRepository.findByEmail.mockResolvedValue(null);

    // Mock: Save returns user with ID
    const savedUser = User.reconstitute({
      userId: '123',
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
    mockUserRepository.save.mockResolvedValue(savedUser);

    // Act
    const result = await useCase.execute(input);

    // Assert - Check returned entity
    expect(result).toBeInstanceOf(User);
    expect(result.getUserId()).toBe('123');
    expect(result.getEmail()).toBe('test@example.com');
    expect(result.getFirstName()).toBe('John');
    expect(result.getLastName()).toBe('Doe');
    expect(result.getUserRole()).toBe('USER');
    expect(result.getUserStatus()).toBe('PENDING');

    // Verify repository calls
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    
    // Verify the saved user has correct properties
    const savedUserArg = mockUserRepository.save.mock.calls[0][0];
    expect(savedUserArg.getEmail()).toBe('test@example.com');
    expect(savedUserArg.getFirstName()).toBe('John');
    expect(savedUserArg.getLastName()).toBe('Doe');
  });

  it('should throw error if email already exists', async () => {
    // Arrange
    const input = {
      email: 'existing@example.com',
      firstName: 'John',
      lastName: 'Doe',
      userRole: 'USER' as const,
    };

    // Mock: Email exists
    const existingUser = User.reconstitute({
      userId: '999',
      email: 'existing@example.com',
      firstName: 'Existing',
      lastName: 'User',
      emailVerified: true,
      userRole: 'USER',
      userStatus: 'ACTIVE',
      data: {},
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);

    // Act & Assert
    await expect(useCase.execute(input)).rejects.toThrow(EmailAlreadyExistsError);

    // Verify save was never called
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should default to USER role if not specified', async () => {
    // Arrange
    const input = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      // userRole not specified
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);

    const savedUser = User.reconstitute({
      userId: '123',
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
    mockUserRepository.save.mockResolvedValue(savedUser);

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(result.getUserRole()).toBe('USER');
  });

  it('should handle domain validation errors', async () => {
    // Arrange
    const input = {
      email: 'invalid-email',  // Invalid email format
      firstName: 'John',
      lastName: 'Doe',
      userRole: 'USER' as const,
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);

    // Act & Assert
    // Domain entity throws error during User.create()
    await expect(useCase.execute(input)).rejects.toThrow(InvalidEmailFormatError);

    // Verify save was never called
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    // Arrange
    const input = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      userRole: 'USER' as const,
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);

    // Mock: Database error during save
    mockUserRepository.save.mockRejectedValue(new Error('Database connection failed'));

    // Act & Assert
    await expect(useCase.execute(input)).rejects.toThrow('Database connection failed');
  });
});
