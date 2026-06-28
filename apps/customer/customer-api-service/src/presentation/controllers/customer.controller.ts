import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersByStatusSchema,
  listCustomersByTierSchema,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersByStatusInput,
  ListCustomersByTierInput,
} from '@mma/contracts/customer';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../decorators/current-user.decorator';
import { CustomerApplicationService } from '../../application/services/customer-application.service';

// ── Shared schema consts ──────────────────────────────────────────────────────
const customerResponseSchema = {
  type: 'object' as const,
  properties: {
    customerId: { type: 'string', example: '01HX4ABCDE' },
    name: { type: 'string', example: 'Acme Corp Contact' },
    email: { type: 'string', format: 'email', example: 'jane@acme.com' },
    userId: { type: 'string', example: '01HX4USER01' },
    company: { type: 'string', example: 'Acme Corp' },
    tier: {
      type: 'string',
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      example: 'PRO',
    },
    customerStatus: {
      type: 'string',
      enum: ['ACTIVE', 'INACTIVE'],
      example: 'ACTIVE',
    },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'customerId',
    'name',
    'email',
    'tier',
    'customerStatus',
    'dateCreated',
    'updatedAt',
  ],
};

const paginatedCustomersResponseSchema = {
  type: 'object' as const,
  properties: {
    data: { type: 'array', items: customerResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6...' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['data'],
};

@ApiTags('customers')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
export class CustomerController {
  constructor(
    private readonly customerApplicationService: CustomerApplicationService,
  ) {}

  // ── STATIC PATHS — declare first ──────────────────────────────────────────

  @Get('by-tier')
  @ApiOperation({
    summary: 'List customers by tier',
    description: 'Returns a cursor-paginated list of customers filtered by tier.',
  })
  @ApiQuery({
    name: 'tier',
    required: true,
    enum: ['FREE', 'PRO', 'ENTERPRISE'],
    description: 'Filter customers by tier',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['next', 'prev'],
    example: 'next',
  })
  @ApiOkResponse({
    description: 'Paginated customer list',
    schema: paginatedCustomersResponseSchema,
  })
  @ApiBadRequestResponse({ description: 'Invalid tier value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listCustomersByTier(
    @Query(new ZodValidationPipe(listCustomersByTierSchema))
    query: ListCustomersByTierInput,
  ) {
    return this.customerApplicationService.listCustomersByTier(
      query.tier,
      query.limit,
      query.direction,
      query.cursor,
    );
  }

  @Get('by-user/:userId')
  @ApiOperation({
    summary: 'Resolve customer by linked auth userId',
    description: 'Resolves the customer record linked to a Cognito userId via GSI3.',
  })
  @ApiParam({ name: 'userId', description: 'Auth userId (Cognito sub)', example: '01HX4USER01' })
  @ApiOkResponse({ description: 'Customer found', schema: customerResponseSchema })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCustomerByUserId(@Param('userId') userId: string) {
    return this.customerApplicationService.getCustomerByUserId(userId);
  }

  @Get()
  @ApiOperation({
    summary: 'List customers by status',
    description: 'Returns a cursor-paginated list of customers filtered by status.',
  })
  @ApiQuery({
    name: 'status',
    required: true,
    enum: ['ACTIVE', 'INACTIVE'],
    description: 'Filter customers by status',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['next', 'prev'],
    example: 'next',
  })
  @ApiOkResponse({
    description: 'Paginated customer list',
    schema: paginatedCustomersResponseSchema,
  })
  @ApiBadRequestResponse({ description: 'Invalid status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listCustomersByStatus(
    @Query(new ZodValidationPipe(listCustomersByStatusSchema))
    query: ListCustomersByStatusInput,
  ) {
    return this.customerApplicationService.listCustomersByStatus(
      query.status,
      query.limit,
      query.direction,
      query.cursor,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new customer',
    description:
      'Admin-create a customer. Email is unique and immutable. tier defaults to FREE, status to ACTIVE.',
  })
  @ApiBody({
    description: 'Customer creation payload',
    schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', example: 'Acme Corp Contact' },
        email: { type: 'string', format: 'email', example: 'jane@acme.com' },
        userId: { type: 'string', example: '01HX4USER01' },
        company: { type: 'string', example: 'Acme Corp' },
        tier: {
          type: 'string',
          enum: ['FREE', 'PRO', 'ENTERPRISE'],
          example: 'PRO',
          description: 'Defaults to FREE if omitted',
        },
      },
      required: ['name', 'email'],
    },
  })
  @ApiCreatedResponse({ description: 'Customer created', schema: customerResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput,
  ) {
    return this.customerApplicationService.createCustomer(body, actor.userId);
  }

  // ── DYNAMIC /:customerId PATHS — declare after all static paths ───────────

  @Get(':customerId')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'customerId', description: 'Customer ULID', example: '01HX4ABCDE' })
  @ApiOkResponse({ description: 'Customer found', schema: customerResponseSchema })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCustomerById(@Param('customerId') customerId: string) {
    return this.customerApplicationService.getCustomerById(customerId);
  }

  @Patch(':customerId')
  @ApiOperation({
    summary: 'Update customer profile',
    description: 'Updates name, company, and/or tier. email cannot be changed.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ULID', example: '01HX4ABCDE' })
  @ApiBody({
    description: 'Customer update payload (name / company / tier only)',
    schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', example: 'New Contact Name' },
        company: { type: 'string', example: 'Acme Corp' },
        tier: {
          type: 'string',
          enum: ['FREE', 'PRO', 'ENTERPRISE'],
          example: 'ENTERPRISE',
        },
      },
      required: [],
    },
  })
  @ApiOkResponse({ description: 'Customer updated', schema: customerResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customerApplicationService.updateCustomer(
      customerId,
      body,
      actor.userId,
    );
  }

  @Post(':customerId/deactivate')
  @ApiOperation({
    summary: 'Deactivate a customer',
    description: 'Soft-disables a customer (ACTIVE -> INACTIVE). Idempotency: fails if already INACTIVE.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ULID', example: '01HX4ABCDE' })
  @ApiOkResponse({ description: 'Customer deactivated', schema: customerResponseSchema })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiConflictResponse({ description: 'Customer is already inactive' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deactivateCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.customerApplicationService.deactivateCustomer(
      customerId,
      actor.userId,
    );
  }
}
