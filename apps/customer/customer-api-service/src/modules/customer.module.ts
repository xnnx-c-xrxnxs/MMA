import { Module } from '@nestjs/common';
import {
  ICustomerRepository,
  CreateCustomerUseCase,
  GetCustomerUseCase,
  GetCustomerByUserIdUseCase,
  UpdateCustomerUseCase,
  DeactivateCustomerUseCase,
  ListCustomersByStatusUseCase,
  ListCustomersByTierUseCase,
} from '@mma/customer-domain';
import {
  DynamoCustomerRepository,
  CustomerSchema,
} from '@mma/customer-domain/infrastructure';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { CustomerApplicationService } from '../application/services/customer-application.service';
import { CustomerController } from '../presentation/controllers/customer.controller';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const CUSTOMERS_REPOSITORY = 'CUSTOMERS_REPOSITORY';

@Module({
  controllers: [CustomerController],
  providers: [
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.CUSTOMERS_DYNAMODB_TABLE_NAME || 'OldSTTable',
          CustomerSchema,
        ),
    },
    {
      provide: CUSTOMERS_REPOSITORY,
      useFactory: (table: Table) => new DynamoCustomerRepository(table),
      inject: [DYNAMO_TABLE],
    },
    {
      provide: CreateCustomerUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new CreateCustomerUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: GetCustomerUseCase,
      useFactory: (repo: ICustomerRepository) => new GetCustomerUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: GetCustomerByUserIdUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new GetCustomerByUserIdUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: UpdateCustomerUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new UpdateCustomerUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: DeactivateCustomerUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new DeactivateCustomerUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: ListCustomersByStatusUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new ListCustomersByStatusUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    {
      provide: ListCustomersByTierUseCase,
      useFactory: (repo: ICustomerRepository) =>
        new ListCustomersByTierUseCase(repo),
      inject: [CUSTOMERS_REPOSITORY],
    },
    CustomerApplicationService,
  ],
  exports: [CustomerApplicationService],
})
export class CustomerModule {}
