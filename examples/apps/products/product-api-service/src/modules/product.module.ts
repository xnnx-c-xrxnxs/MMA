import { Module } from '@nestjs/common';
import { Table } from 'dynamodb-onetable';
import {
  IProductRepository,
  ICategoryRepository,
  CreateProductUseCase,
  GetProductByIdUseCase,
  UpdateProductDetailsUseCase,
  UpdateProductPriceUseCase,
  UpdateProductInventoryUseCase,
  ActivateProductUseCase,
  DeactivateProductUseCase,
  DiscontinueProductUseCase,
  DeleteProductUseCase,
  ListProductsByStatusUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsByNameUseCase,
  CheckProductsAvailabilityUseCase,
  CreateCategoryUseCase,
  GetCategoryByIdUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '@old-st/product-domain';
import {
  DynamoProductRepository,
  DynamoCategoryRepository,
  ProductSchema,
} from '@old-st/product-domain/infrastructure';
import { SqsFifoEventPublisher, createLocalSqsClient, createAwsSqsClient } from '@old-st/aws-sqs';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { ProductApplicationService } from '../application/services/product-application.service';
import { CategoryApplicationService } from '../application/services/category-application.service';
import { ProductController } from '../presentation/controllers/product.controller';
import { CategoryController } from '../presentation/controllers/category.controller';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';
const CATEGORY_REPOSITORY = 'CATEGORY_REPOSITORY';
const PRODUCT_EVENT_PUBLISHER = 'PRODUCT_EVENT_PUBLISHER';

@Module({
  controllers: [ProductController, CategoryController],
  providers: [
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
    {
      provide: CATEGORY_REPOSITORY,
      useFactory: (table: Table) => new DynamoCategoryRepository(table),
      inject: [DYNAMO_TABLE],
    },
    // ------- Product Use Cases -------
    {
      provide: CreateProductUseCase,
      useFactory: (productRepo: IProductRepository, categoryRepo: ICategoryRepository) =>
        new CreateProductUseCase(productRepo, categoryRepo),
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
    },
    {
      provide: GetProductByIdUseCase,
      useFactory: (repo: IProductRepository) => new GetProductByIdUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: UpdateProductDetailsUseCase,
      useFactory: (productRepo: IProductRepository, categoryRepo: ICategoryRepository) =>
        new UpdateProductDetailsUseCase(productRepo, categoryRepo),
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
    },
    {
      provide: UpdateProductPriceUseCase,
      useFactory: (repo: IProductRepository) => new UpdateProductPriceUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: UpdateProductInventoryUseCase,
      useFactory: (repo: IProductRepository) => new UpdateProductInventoryUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ActivateProductUseCase,
      useFactory: (repo: IProductRepository) => new ActivateProductUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: DeactivateProductUseCase,
      useFactory: (repo: IProductRepository) => new DeactivateProductUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: DiscontinueProductUseCase,
      useFactory: (repo: IProductRepository) => new DiscontinueProductUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: DeleteProductUseCase,
      useFactory: (repo: IProductRepository) => new DeleteProductUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ListProductsByStatusUseCase,
      useFactory: (repo: IProductRepository) => new ListProductsByStatusUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ListProductsByCategoryUseCase,
      useFactory: (productRepo: IProductRepository, categoryRepo: ICategoryRepository) =>
        new ListProductsByCategoryUseCase(productRepo, categoryRepo),
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
    },
    {
      provide: SearchProductsByNameUseCase,
      useFactory: (repo: IProductRepository) => new SearchProductsByNameUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: CheckProductsAvailabilityUseCase,
      useFactory: (repo: IProductRepository) =>
        new CheckProductsAvailabilityUseCase(repo),
      inject: [PRODUCT_REPOSITORY],
    },
    // ------- Category Use Cases -------
    {
      provide: CreateCategoryUseCase,
      useFactory: (repo: ICategoryRepository) => new CreateCategoryUseCase(repo),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: GetCategoryByIdUseCase,
      useFactory: (repo: ICategoryRepository) => new GetCategoryByIdUseCase(repo),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: ListCategoriesUseCase,
      useFactory: (repo: ICategoryRepository) => new ListCategoriesUseCase(repo),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: UpdateCategoryUseCase,
      useFactory: (repo: ICategoryRepository) => new UpdateCategoryUseCase(repo),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: DeleteCategoryUseCase,
      useFactory: (repo: ICategoryRepository) => new DeleteCategoryUseCase(repo),
      inject: [CATEGORY_REPOSITORY],
    },
    // ------- Event Publisher -------
    {
      provide: PRODUCT_EVENT_PUBLISHER,
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
    // ------- Application Services -------
    ProductApplicationService,
    CategoryApplicationService,
  ],
  exports: [ProductApplicationService, CategoryApplicationService],
})
export class ProductModule {}
