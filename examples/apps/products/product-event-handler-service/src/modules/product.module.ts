import { Module } from '@nestjs/common';
import { Table } from 'dynamodb-onetable';
import {
  IProductRepository,
  CheckProductsAvailabilityUseCase,
} from '@old-st/product-domain';
import {
  DynamoProductRepository,
  ProductSchema,
} from '@old-st/product-domain/infrastructure';
import {
  SqsFifoEventPublisher,
  createLocalSqsClient,
  createAwsSqsClient,
} from '@old-st/aws-sqs';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { ProductEventHandlerService } from '../application/services/product-event-handler.service';
import { OrderCreatedHandler } from '../application/services/handlers';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';
const VALIDATION_RESULT_PUBLISHER = 'VALIDATION_RESULT_PUBLISHER';

@Module({
  // No controllers — event-driven service
  providers: [
    // --- Infrastructure ---
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.PRODUCTS_DYNAMODB_TABLE_NAME || 'OldSTTable',
          ProductSchema,
        ),
    },
    {
      provide: PRODUCT_REPOSITORY,
      useFactory: (table: Table) => new DynamoProductRepository(table),
      inject: [DYNAMO_TABLE],
    },
    // --- Event Publisher (publishes validation results to order-events queue) ---
    {
      provide: VALIDATION_RESULT_PUBLISHER,
      useFactory: () => {
        const client =
          process.env.STAGE === 'local'
            ? createLocalSqsClient()
            : createAwsSqsClient();
        const queueUrl = process.env.ORDER_EVENTS_SQS_QUEUE_URL ?? '';
        if (!queueUrl && process.env.STAGE !== 'local') {
          throw new Error('Missing required env var: ORDER_EVENTS_SQS_QUEUE_URL');
        }
        return new SqsFifoEventPublisher(client, queueUrl);
      },
    },
    // --- Use Cases ---
    {
      provide: CheckProductsAvailabilityUseCase,
      useFactory: (repo: IProductRepository) =>
        new CheckProductsAvailabilityUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    // --- Per-event handlers ---
    OrderCreatedHandler,
    // --- Dispatcher ---
    ProductEventHandlerService,
    // --- Local SQS polling ---
    SqsLocalService,
  ],
  exports: [ProductEventHandlerService],
})
export class ProductModule {}
