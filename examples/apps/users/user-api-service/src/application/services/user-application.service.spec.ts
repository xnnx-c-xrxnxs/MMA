import { UserApplicationService } from './user-application.service';
import { User } from '@old-st/user-domain';

// Mock the Zod schema parse to pass through
jest.mock('@old-st/contracts/user', () => ({
  ...jest.requireActual('@old-st/contracts/user'),
  userResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

function createMockUser(overrides: Partial<Record<string, unknown>> = {}): User {
  return User.reconstitute({
    userId: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: false,
    userRole: 'USER',
    userStatus: 'PENDING',
    data: {},
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function createMockUseCases() {
  return {
    createUserUseCase: { execute: jest.fn() },
    getUserByIdUseCase: { execute: jest.fn() },
    getUserByEmailUseCase: { execute: jest.fn() },
    updateUserProfileUseCase: { execute: jest.fn() },
    deleteUserUseCase: { execute: jest.fn() },
    activateUserUseCase: { execute: jest.fn() },
    deactivateUserUseCase: { execute: jest.fn() },
    verifyUserEmailUseCase: { execute: jest.fn() },
    updateUserRoleUseCase: { execute: jest.fn() },
    listUsersByStatusUseCase: { execute: jest.fn() },
    listUsersByRoleAndStatusUseCase: { execute: jest.fn() },
  };
}

function createMockEventPublisher() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

describe('UserApplicationService', () => {
  let service: UserApplicationService;
  let mocks: ReturnType<typeof createMockUseCases>;
  let mockPublisher: ReturnType<typeof createMockEventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockUseCases();
    mockPublisher = createMockEventPublisher();
    service = new UserApplicationService(
      mocks.createUserUseCase as any,
      mocks.getUserByIdUseCase as any,
      mocks.getUserByEmailUseCase as any,
      mocks.updateUserProfileUseCase as any,
      mocks.deleteUserUseCase as any,
      mocks.activateUserUseCase as any,
      mocks.deactivateUserUseCase as any,
      mocks.verifyUserEmailUseCase as any,
      mocks.updateUserRoleUseCase as any,
      mocks.listUsersByStatusUseCase as any,
      mocks.listUsersByRoleAndStatusUseCase as any,
      mockPublisher as any,
    );
  });

  describe('createUser', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser();
      mocks.createUserUseCase.execute.mockResolvedValue(user);

      const result = await service.createUser({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userRole: 'USER',
      });

      expect(mocks.createUserUseCase.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userRole: 'USER',
        data: undefined,
      });
      expect(result.userId).toBe('user-1');
    });
  });

  describe('getUserById', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser();
      mocks.getUserByIdUseCase.execute.mockResolvedValue(user);

      const result = await service.getUserById('user-1');

      expect(mocks.getUserByIdUseCase.execute).toHaveBeenCalledWith('user-1');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('getUserByEmail', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser();
      mocks.getUserByEmailUseCase.execute.mockResolvedValue(user);

      const result = await service.getUserByEmail('test@example.com');

      expect(mocks.getUserByEmailUseCase.execute).toHaveBeenCalledWith('test@example.com');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('updateUserProfile', () => {
    it('should delegate to use case with userId merged', async () => {
      const user = createMockUser({ firstName: 'Jane' });
      mocks.updateUserProfileUseCase.execute.mockResolvedValue(user);

      const result = await service.updateUserProfile('user-1', {
        firstName: 'Jane',
      });

      expect(mocks.updateUserProfileUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        firstName: 'Jane',
      });
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('deleteUser', () => {
    it('should delete user and publish USER_DELETED event', async () => {
      const user = createMockUser();
      mocks.deleteUserUseCase.execute.mockResolvedValue(user);

      await service.deleteUser('user-1');

      expect(mocks.deleteUserUseCase.execute).toHaveBeenCalledWith('user-1');
      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'USER_DELETED',
          userId: 'user-1',
          email: 'test@example.com',
        }),
      );
    });
  });

  describe('activateUser', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser({ userStatus: 'ACTIVE' });
      mocks.activateUserUseCase.execute.mockResolvedValue(user);

      const result = await service.activateUser('user-1');

      expect(mocks.activateUserUseCase.execute).toHaveBeenCalledWith('user-1');
      expect(result.userStatus).toBe('ACTIVE');
    });
  });

  describe('deactivateUser', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser({ userStatus: 'INACTIVE' });
      mocks.deactivateUserUseCase.execute.mockResolvedValue(user);

      const result = await service.deactivateUser('user-1');

      expect(result.userStatus).toBe('INACTIVE');
    });
  });

  describe('verifyUserEmail', () => {
    it('should delegate to use case and return DTO', async () => {
      const user = createMockUser({ emailVerified: true });
      mocks.verifyUserEmailUseCase.execute.mockResolvedValue(user);

      const result = await service.verifyUserEmail('user-1');

      expect(mocks.verifyUserEmailUseCase.execute).toHaveBeenCalledWith('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('updateUserRole', () => {
    it('should delegate to use case with userId and new role', async () => {
      const user = createMockUser({ userRole: 'ADMIN' });
      mocks.updateUserRoleUseCase.execute.mockResolvedValue(user);

      const result = await service.updateUserRole('user-1', 'ADMIN');

      expect(mocks.updateUserRoleUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        newRole: 'ADMIN',
      });
      expect(result.userRole).toBe('ADMIN');
    });
  });

  describe('listUsersByStatus', () => {
    it('should route cursor to nextCursorPointer when direction is next', async () => {
      mocks.listUsersByStatusUseCase.execute.mockResolvedValue({
        data: [createMockUser()],
        nextCursorPointer: 'next-cursor',
        prevCursorPointer: undefined,
      });

      const result = await service.listUsersByStatus({
        userStatus: 'ACTIVE',
        direction: 'next',
        cursor: 'my-cursor',
        limit: 10,
      });

      expect(mocks.listUsersByStatusUseCase.execute).toHaveBeenCalledWith({
        status: 'ACTIVE',
        limit: 10,
        direction: 'next',
        nextCursorPointer: 'my-cursor',
        prevCursorPointer: undefined,
      });
      expect(result.data).toHaveLength(1);
      expect(result.nextCursorPointer).toBe('next-cursor');
    });

    it('should route cursor to prevCursorPointer when direction is prev', async () => {
      mocks.listUsersByStatusUseCase.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: undefined,
        prevCursorPointer: 'prev-cursor',
      });

      await service.listUsersByStatus({
        userStatus: 'ACTIVE',
        limit: 20,
        direction: 'prev',
        cursor: 'my-cursor',
      });

      expect(mocks.listUsersByStatusUseCase.execute).toHaveBeenCalledWith({
        status: 'ACTIVE',
        limit: 20,
        direction: 'prev',
        nextCursorPointer: undefined,
        prevCursorPointer: 'my-cursor',
      });
    });
  });

  describe('listUsersByRoleAndStatus', () => {
    it('should pass role and status with cursor routing', async () => {
      mocks.listUsersByRoleAndStatusUseCase.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: undefined,
        prevCursorPointer: undefined,
      });

      await service.listUsersByRoleAndStatus({
        userRole: 'ADMIN',
        userStatus: 'ACTIVE',
        direction: 'next',
        limit: 5,
      });

      expect(mocks.listUsersByRoleAndStatusUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
          status: 'ACTIVE',
          limit: 5,
          direction: 'next',
        }),
      );
    });
  });

  describe('error propagation', () => {
    it('should propagate use case errors', async () => {
      mocks.getUserByIdUseCase.execute.mockRejectedValue(new Error('Not found'));

      await expect(service.getUserById('nonexistent')).rejects.toThrow('Not found');
    });
  });
});
