import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IPaginatedResponse, IEventPublisher } from '@old-st/common';

const logger = createLogger('user-api-service');
import {
  userResponseSchema,
  CreateUserInput,
  UpdateUserInput,
  UserResponse,
  ListUsersByStatusInput,
  ListUsersByRoleAndStatusInput,
  UserDomainEvent,
} from '@old-st/contracts/user';
import { PaginatedResponse } from '@old-st/contracts/common';
import {
  User,
  UserRole,
  CreateUserUseCase,
  GetUserByIdUseCase,
  GetUserByEmailUseCase,
  UpdateUserProfileUseCase,
  DeleteUserUseCase,
  ActivateUserUseCase,
  DeactivateUserUseCase,
  VerifyUserEmailUseCase,
  UpdateUserRoleUseCase,
  ListUsersByStatusUseCase,
  ListUsersByRoleAndStatusUseCase,
} from '@old-st/user-domain';

/**
 * User Application Service
 * Orchestrates use cases and transforms domain entities to API DTOs
 * This is the service-specific layer that adds:
 * - DTO transformation
 * - API response formatting
 */
@Injectable()
export class UserApplicationService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly activateUserUseCase: ActivateUserUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
    private readonly verifyUserEmailUseCase: VerifyUserEmailUseCase,
    private readonly updateUserRoleUseCase: UpdateUserRoleUseCase,
    private readonly listUsersByStatusUseCase: ListUsersByStatusUseCase,
    private readonly listUsersByRoleAndStatusUseCase: ListUsersByRoleAndStatusUseCase,
    @Inject('USER_EVENT_PUBLISHER')
    private readonly eventPublisher: IEventPublisher<UserDomainEvent>,
  ) {}

  /**
   * Transform domain entity to API DTO
   * Uses Zod validation from @old-st/contracts
   */
  private toDto(user: User): UserResponse {
    return userResponseSchema.parse({
      userId: user.getUserId(),
      email: user.getEmail(),
      firstName: user.getFirstName(),
      lastName: user.getLastName(),
      userRole: user.getUserRole(),
      userStatus: user.getUserStatus(),
      data: user.getData(),
      dateCreated: user.getDateCreated(),
      updatedAt: user.getUpdatedAt(),
    });
  }

  /**
   * Transform paginated domain entities to paginated DTOs
   * Uses @old-st/common (IPaginatedResponse) internally
   * Returns @old-st/contracts (PaginatedResponse) for API
   */
  private toPaginatedDto(
    result: IPaginatedResponse<User>
  ): PaginatedResponse<UserResponse> {
    return {
      data: result.data.map((user) => this.toDto(user)),
      nextCursorPointer: result.nextCursorPointer,
      prevCursorPointer: result.prevCursorPointer,
    };
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput, actorId: string): Promise<UserResponse> {
    logger.info('Creating user', { email: input.email, userRole: input.userRole, actorId });
    const user = await this.createUserUseCase.execute({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      userRole: input.userRole,
      data: input.data,
    });
    logger.info('User created', { userId: user.getUserId(), email: user.getEmail(), userRole: user.getUserRole(), actorId });
    return this.toDto(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse> {
    logger.info('Retrieving user by ID', { userId });
    const user = await this.getUserByIdUseCase.execute(userId);
    logger.info('User retrieved', { userId, userStatus: user.getUserStatus() });
    return this.toDto(user);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserResponse> {
    const user = await this.getUserByEmailUseCase.execute(email);
    return this.toDto(user);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    input: UpdateUserInput,
    actorId: string,
  ): Promise<UserResponse> {
    logger.info('Updating user profile', { userId, fields: Object.keys(input).filter(k => (input as Record<string,unknown>)[k] !== undefined), actorId });
    const user = await this.updateUserProfileUseCase.execute({ userId, ...input });
    logger.info('User profile updated', { userId: user.getUserId(), actorId });
    return this.toDto(user);
  }

  /**
   * Delete user
   * Executes the delete use case then publishes a USER_DELETED event.
   * The full user snapshot is included in the payload because the record
   * is no longer queryable after deletion.
   */
  async deleteUser(userId: string, actorId: string): Promise<void> {
    logger.info('Deleting user', { userId, actorId });
    const user = await this.deleteUserUseCase.execute(userId);
    const deletedUserId = user.getUserId();
    if (!deletedUserId) throw new Error('Deleted user missing userId');
    logger.info('User deleted — publishing USER_DELETED event', { userId: deletedUserId, actorId });
    await this.eventPublisher.publish({
      eventType: 'USER_DELETED',
      userId: deletedUserId,
      email: user.getEmail(),
      firstName: user.getFirstName(),
      lastName: user.getLastName(),
      userRole: user.getUserRole(),
      userStatus: user.getUserStatus(),
      data: (user.getData() ?? {}) as Record<string, unknown>,
      dateCreated: user.getDateCreated() ?? undefined,
      deletedAt: new Date().toISOString(),
    }, { groupId: deletedUserId });
  }

  /**
   * Activate user
   */
  async activateUser(userId: string, actorId: string): Promise<UserResponse> {
    logger.info('Activating user', { userId, actorId });
    const user = await this.activateUserUseCase.execute(userId);
    logger.info('User activated', { userId: user.getUserId(), userStatus: user.getUserStatus(), actorId });
    return this.toDto(user);
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string, actorId: string): Promise<UserResponse> {
    logger.info('Deactivating user', { userId, actorId });
    const user = await this.deactivateUserUseCase.execute(userId);
    logger.info('User deactivated', { userId: user.getUserId(), userStatus: user.getUserStatus(), actorId });
    return this.toDto(user);
  }

  /**
   * Verify user email
   */
  async verifyUserEmail(userId: string, actorId: string): Promise<UserResponse> {
    logger.info('Verifying user email', { userId, actorId });
    const user = await this.verifyUserEmailUseCase.execute(userId);
    logger.info('User email verified', { userId: user.getUserId(), actorId });
    return this.toDto(user);
  }

  /**
   * Update user role (admin operation)
   */
  async updateUserRole(
    userId: string,
    userRole: UserRole,
    actorId: string,
  ): Promise<UserResponse> {
    logger.info('Updating user role', { userId, newRole: userRole, actorId });
    const user = await this.updateUserRoleUseCase.execute({ userId, newRole: userRole });
    logger.info('User role updated', { userId: user.getUserId(), userRole: user.getUserRole(), actorId });
    return this.toDto(user);
  }

  /**
   * List users by status with pagination
   */
  async listUsersByStatus(
    input: ListUsersByStatusInput
  ): Promise<PaginatedResponse<UserResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.listUsersByStatusUseCase.execute({
      status: input.userStatus,
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  /**
   * List users by role and status with pagination
   */
  async listUsersByRoleAndStatus(
    input: ListUsersByRoleAndStatusInput
  ): Promise<PaginatedResponse<UserResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.listUsersByRoleAndStatusUseCase.execute({
      role: input.userRole,
      status: input.userStatus,
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }
}
