import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  userStatusSchema,
  userRoleSchema,
  CreateUserInput,
  UpdateUserInput,
  UpdateUserRoleInput,
  ListUsersByStatusInput,
  ListUsersByRoleAndStatusInput,
} from '@old-st/contracts/user';
import { UserApplicationService } from '../../application/services/user-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { CurrentUser } from '../decorators/current-user.decorator';

/**
 * Query schemas with number coercion for HTTP query parameters
 * (Query params arrive as strings; z.coerce.number() converts them)
 */
const getUserByEmailQuerySchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
});

const listByStatusQuerySchema = z.object({
  userStatus: userStatusSchema,
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

const listByRoleAndStatusQuerySchema = z.object({
  userRole: userRoleSchema,
  userStatus: userStatusSchema,
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

// ── Shared response shape (reused across Swagger response decorators) ──────────
const userResponseSchema = {
  type: 'object' as const,
  properties: {
    userId:      { type: 'string', example: 'usr_01HX4ABCDE' },
    email:       { type: 'string', format: 'email', example: 'alice@example.com' },
    firstName:   { type: 'string', example: 'Alice' },
    lastName:    { type: 'string', example: 'Smith' },
    userRole:    { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
    userStatus:  { type: 'string', enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], example: 'ACTIVE' },
    data: {
      type: 'object',
      properties: {
        country: { type: 'string', example: 'US' },
      },
    },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['userId', 'email', 'firstName', 'lastName', 'userRole', 'userStatus', 'updatedAt'],
};

const paginatedUsersResponseSchema = {
  type: 'object' as const,
  properties: {
    data: { type: 'array', items: userResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6InVzciMwMSJ9' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['data'],
};

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userApplicationService: UserApplicationService) {}

  // ------------------------------------------------------------------
  // Static paths — must be declared before dynamic /:userId routes
  // ------------------------------------------------------------------

  @Get('by-status')
  @ApiOperation({
    summary: 'List users by status',
    description: 'Returns a cursor-paginated list of users filtered by status.',
  })
  @ApiQuery({ name: 'userStatus', required: true, enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], description: 'Filter by user status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated list of users', schema: paginatedUsersResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listUsersByStatus(
    @Query(new ZodValidationPipe(listByStatusQuerySchema))
    query: ListUsersByStatusInput,
  ) {
    return this.userApplicationService.listUsersByStatus(query);
  }

  @Get('by-role-and-status')
  @ApiOperation({
    summary: 'List users by role and status',
    description: 'Returns a cursor-paginated list of users filtered by both role and status.',
  })
  @ApiQuery({ name: 'userRole', required: true, enum: ['USER', 'ADMIN'], description: 'Filter by user role' })
  @ApiQuery({ name: 'userStatus', required: true, enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'], description: 'Filter by user status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated list of users', schema: paginatedUsersResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid role or status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listUsersByRoleAndStatus(
    @Query(new ZodValidationPipe(listByRoleAndStatusQuerySchema))
    query: ListUsersByRoleAndStatusInput,
  ) {
    return this.userApplicationService.listUsersByRoleAndStatus(query);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user by email',
    description: 'Looks up a single user by their email address.',
  })
  @ApiQuery({ name: 'email', required: true, type: String, description: 'Email address to look up', example: 'alice@example.com' })
  @ApiOkResponse({ description: 'User found', schema: userResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid email format' })
  @ApiNotFoundResponse({ description: 'No user found with that email' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getUserByEmail(
    @Query(new ZodValidationPipe(getUserByEmailQuerySchema)) query: { email: string },
  ) {
    return this.userApplicationService.getUserByEmail(query.email);
  }

  // ------------------------------------------------------------------
  // Dynamic /:userId routes
  // ------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a user with PENDING status. The email must be unique across all users.',
  })
  @ApiBody({
    description: 'User creation payload',
    schema: {
      type: 'object',
      properties: {
        email:    { type: 'string', format: 'email', example: 'alice@example.com' },
        firstName: { type: 'string', example: 'Alice' },
        lastName:  { type: 'string', example: 'Smith' },
        userRole:  { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER', description: 'Defaults to USER if omitted' },
        data: {
          type: 'object',
          properties: {
            country: { type: 'string', example: 'US' },
          },
        },
      },
      required: ['email', 'firstName', 'lastName'],
    },
  })
  @ApiCreatedResponse({ description: 'User created successfully', schema: userResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error — invalid input fields' })
  @ApiConflictResponse({ description: 'A user with this email already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createUser(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.createUser(body, actorId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiOkResponse({ description: 'User found', schema: userResponseSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getUserById(@Param('userId') userId: string) {
    return this.userApplicationService.getUserById(userId);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Partially updates firstName, lastName, or data. All fields are optional.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiBody({
    description: 'Fields to update (all optional)',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'Alice' },
        lastName:  { type: 'string', example: 'Smith' },
        data: {
          type: 'object',
          properties: {
            country: { type: 'string', example: 'US' },
          },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'User updated', schema: userResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateUserProfile(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.updateUserProfile(userId, body, actorId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user', description: 'Permanently removes the user record.' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    await this.userApplicationService.deleteUser(userId, actorId);
  }

  @Post(':userId/verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify user email',
    description: 'Marks the user email as verified. User must be in PENDING or ACTIVE status.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Email verified', schema: userResponseSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Email already verified or invalid status transition' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  verifyUserEmail(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.verifyUserEmail(userId, actorId);
  }

  @Post(':userId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate user',
    description: 'Transitions the user to ACTIVE status. Only valid from PENDING or INACTIVE.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiOkResponse({ description: 'User activated', schema: userResponseSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'User is already active or cannot transition from current status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  activateUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.activateUser(userId, actorId);
  }

  @Post(':userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Transitions the user to INACTIVE status. Only valid from ACTIVE.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiOkResponse({ description: 'User deactivated', schema: userResponseSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'User is already inactive or cannot transition from current status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deactivateUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.deactivateUser(userId, actorId);
  }

  @Patch(':userId/role')
  @ApiOperation({ summary: 'Update user role', description: 'Assigns a new role to the user.' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: 'usr_01HX4ABCDE' })
  @ApiBody({
    description: 'New role for the user',
    schema: {
      type: 'object',
      properties: {
        userRole: { type: 'string', enum: ['USER', 'ADMIN'], example: 'ADMIN' },
      },
      required: ['userRole'],
    },
  })
  @ApiOkResponse({ description: 'Role updated', schema: userResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid role value' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateUserRole(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.updateUserRole(userId, body.userRole, actorId);
  }
}
