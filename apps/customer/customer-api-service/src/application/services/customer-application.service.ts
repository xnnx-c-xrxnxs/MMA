import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import { IPaginatedResponse } from '@mma/common';
import {
  customerResponseSchema,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerResponse,
  CustomerListResponse,
  CustomerStatus,
  CustomerTier,
} from '@mma/contracts/customer';
import { PaginatedResponse } from '@mma/contracts/common';
import {
  Customer,
  CreateCustomerUseCase,
  GetCustomerUseCase,
  GetCustomerByUserIdUseCase,
  UpdateCustomerUseCase,
  DeactivateCustomerUseCase,
  ListCustomersByStatusUseCase,
  ListCustomersByTierUseCase,
} from '@mma/customer-domain';

const logger = createLogger('customer-api-service');

@Injectable()
export class CustomerApplicationService {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly getCustomerByUserIdUseCase: GetCustomerByUserIdUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deactivateCustomerUseCase: DeactivateCustomerUseCase,
    private readonly listCustomersByStatusUseCase: ListCustomersByStatusUseCase,
    private readonly listCustomersByTierUseCase: ListCustomersByTierUseCase,
  ) {}

  private toDto(entity: Customer): CustomerResponse {
    return customerResponseSchema.parse({
      customerId: entity.getCustomerId(),
      name: entity.getName(),
      email: entity.getEmail(),
      userId: entity.getUserId(),
      company: entity.getCompany(),
      tier: entity.getTier(),
      customerStatus: entity.getCustomerStatus(),
      dateCreated: entity.getDateCreated(),
      updatedAt: entity.getUpdatedAt(),
    });
  }

  private toPaginatedDto(
    result: IPaginatedResponse<Customer>,
  ): CustomerListResponse {
    return {
      data: result.data.map((e) => this.toDto(e)),
      nextCursorPointer: result.nextCursorPointer,
      prevCursorPointer: result.prevCursorPointer,
    } as PaginatedResponse<CustomerResponse>;
  }

  async createCustomer(
    input: CreateCustomerInput,
    actorId: string,
  ): Promise<CustomerResponse> {
    logger.info('Creating customer', { actorId, email: input.email });
    const customer = await this.createCustomerUseCase.execute(input);
    logger.info('Customer created', {
      actorId,
      customerId: customer.getCustomerId(),
    });
    return this.toDto(customer);
  }

  async getCustomerById(customerId: string): Promise<CustomerResponse> {
    const customer = await this.getCustomerUseCase.execute(customerId);
    return this.toDto(customer);
  }

  async getCustomerByUserId(userId: string): Promise<CustomerResponse> {
    const customer = await this.getCustomerByUserIdUseCase.execute(userId);
    return this.toDto(customer);
  }

  async listCustomersByStatus(
    status: CustomerStatus,
    limit?: number,
    direction?: string,
    cursor?: string,
  ): Promise<CustomerListResponse> {
    const result = await this.listCustomersByStatusUseCase.execute({
      status,
      limit,
      direction,
      nextCursorPointer: direction === 'prev' ? undefined : cursor,
      prevCursorPointer: direction === 'prev' ? cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async listCustomersByTier(
    tier: CustomerTier,
    limit?: number,
    direction?: string,
    cursor?: string,
  ): Promise<CustomerListResponse> {
    const result = await this.listCustomersByTierUseCase.execute({
      tier,
      limit,
      direction,
      nextCursorPointer: direction === 'prev' ? undefined : cursor,
      prevCursorPointer: direction === 'prev' ? cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async updateCustomer(
    customerId: string,
    input: UpdateCustomerInput,
    actorId: string,
  ): Promise<CustomerResponse> {
    logger.info('Updating customer', { actorId, customerId });
    const customer = await this.updateCustomerUseCase.execute({
      customerId,
      ...input,
    });
    logger.info('Customer updated', { actorId, customerId });
    return this.toDto(customer);
  }

  async deactivateCustomer(
    customerId: string,
    actorId: string,
  ): Promise<CustomerResponse> {
    logger.info('Deactivating customer', { actorId, customerId });
    const customer = await this.deactivateCustomerUseCase.execute({
      customerId,
    });
    logger.info('Customer deactivated', { actorId, customerId });
    return this.toDto(customer);
  }
}
