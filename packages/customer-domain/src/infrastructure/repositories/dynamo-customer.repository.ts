import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@mma/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@mma/dynamodb-onetable';
import { CustomerStatus, CustomerTier } from '../../domain/constants';
import { ICustomerRepository } from '../../application/interfaces/customer-repository.interface';
import { Customer } from '../../domain/entities';
import { CustomerDataType } from '../schemas/CustomerSchema';

interface ICustomerModel {
  create(properties: object): Promise<CustomerDataType>;
  upsert(properties: object): Promise<CustomerDataType>;
  get(
    properties: object,
    options?: object,
  ): Promise<CustomerDataType | undefined>;
  find(properties: object, options?: object): Promise<CustomerDataType[]>;
}

export class DynamoCustomerRepository implements ICustomerRepository {
  private readonly CustomerModel: ICustomerModel;

  constructor(private readonly table: Table) {
    this.CustomerModel = this.table.getModel(
      'Customer',
    ) as unknown as ICustomerModel;
  }

  async save(customer: Customer): Promise<Customer> {
    const data = this.toPersistence(customer);
    if (customer.getCustomerId()) {
      const updated = await this.CustomerModel.upsert(data);
      return this.toDomain(updated);
    }
    const created = await this.CustomerModel.create(data);
    return this.toDomain(created);
  }

  async findById(customerId: string): Promise<Customer | null> {
    const result = await this.CustomerModel.get({ customerId });
    return result ? this.toDomain(result) : null;
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    const results = await this.CustomerModel.find(
      { userId },
      { index: 'GSI3', limit: 1 },
    );
    return results.length > 0 ? this.toDomain(results[0]) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const results = await this.CustomerModel.find(
      { email },
      { index: 'GSI4', limit: 1 },
    );
    return results.length > 0 ? this.toDomain(results[0]) : null;
  }

  async listByStatus(
    customerStatus: CustomerStatus,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<Customer>> {
    const cursorPointer =
      direction === 'prev' ? prevCursorPointer : nextCursorPointer;
    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI1',
      direction,
      cursorPointer || '',
    );
    const results = await this.CustomerModel.find(
      { customerStatus },
      dynamoDbOptions,
    );
    const paginated = pageRecordHandler<CustomerDataType>(
      [...results],
      limit,
      direction,
      'GSI1PK',
      'GSI1SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || '',
    );
    return {
      data: paginated.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginated.nextCursorPointer,
      prevCursorPointer: paginated.prevCursorPointer,
    };
  }

  async listByTier(
    tier: CustomerTier,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<Customer>> {
    const cursorPointer =
      direction === 'prev' ? prevCursorPointer : nextCursorPointer;
    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI2',
      direction,
      cursorPointer || '',
    );
    const results = await this.CustomerModel.find({ tier }, dynamoDbOptions);
    const paginated = pageRecordHandler<CustomerDataType>(
      [...results],
      limit,
      direction,
      'GSI2PK',
      'GSI2SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || '',
    );
    return {
      data: paginated.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginated.nextCursorPointer,
      prevCursorPointer: paginated.prevCursorPointer,
    };
  }

  private toDomain(raw: CustomerDataType): Customer {
    const record = raw as CustomerDataType & {
      createdAt?: Date | string;
      updatedAt?: Date | string;
    };
    const toIso = (v: Date | string | undefined, fallback: string): string => {
      if (!v) return fallback;
      return v instanceof Date ? v.toISOString() : v;
    };
    const dateCreated = record.dateCreated ?? new Date().toISOString();
    const customerId = record.customerId;
    if (!customerId) throw new Error('DynamoDB record missing customerId');

    return Customer.reconstitute({
      customerId,
      name: record.name,
      email: record.email,
      userId: record.userId,
      company: record.company,
      tier: record.tier as CustomerTier,
      customerStatus: record.customerStatus as CustomerStatus,
      dateCreated,
      updatedAt: toIso(record.updatedAt, dateCreated),
    });
  }

  private toPersistence(customer: Customer): Partial<CustomerDataType> {
    const customerId = customer.getCustomerId();
    return {
      ...(customerId && { customerId }),
      name: customer.getName(),
      email: customer.getEmail(),
      userId: customer.getUserId(),
      company: customer.getCompany(),
      tier: customer.getTier(),
      customerStatus: customer.getCustomerStatus(),
      dateCreated: customer.getDateCreated(),
    } as Partial<CustomerDataType>;
  }
}
