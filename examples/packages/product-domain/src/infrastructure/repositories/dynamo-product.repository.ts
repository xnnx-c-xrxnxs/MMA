import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@old-st/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@old-st/dynamodb-onetable';
import { IProductRepository } from '../../application/interfaces/product/product-repository.interface';
import { ProductStatus } from '../../domain/constants';
import { Product } from '../../domain/entities';
import { ProductDataType } from '../schemas/ProductSchema';

/**
 * Local structural interface for the dynamodb-onetable Model instance.
 * Avoiding dynamodb-onetable's complex EntityParametersForCreate mapped types.
 */
interface IProductModel {
  create(properties: object): Promise<ProductDataType>;
  upsert(properties: object): Promise<ProductDataType>;
  get(properties: object, options?: object): Promise<ProductDataType | undefined>;
  find(properties: object, options?: object): Promise<ProductDataType[]>;
}

export class DynamoProductRepository implements IProductRepository {
  private readonly ProductModel: IProductModel;

  constructor(private readonly table: Table) {
    this.ProductModel = this.table.getModel('Product') as unknown as IProductModel;
  }

  /**
   * Save a product entity (create or update)
   */
  async save(product: Product): Promise<Product> {
    const data = this.toPersistence(product);

    if (product.getProductId()) {
      const updated = await this.ProductModel.upsert(data);
      return this.toDomain(updated);
    } else {
      const created = await this.ProductModel.create(data);
      return this.toDomain(created);
    }
  }

  /**
   * Find product by ID (Primary Key)
   */
  async findById(productId: string): Promise<Product | null> {
    const result = await this.ProductModel.get({ productId });
    return result ? this.toDomain(result) : null;
  }

  /**
   * List products by status (GSI1: GSI1PK = 'PRODUCT#{status}', GSI1SK = name)
   */
  async listByStatus(
    status: ProductStatus,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>> {
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI1',
      direction,
      cursorPointer || ''
    );

    const results = await this.ProductModel.find({ status }, dynamoDbOptions);

    const paginatedResult = pageRecordHandler<ProductDataType>(
      [...results],
      limit,
      direction,
      'GSI1PK',
      'GSI1SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || ''
    );

    return {
      data: paginatedResult.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginatedResult.nextCursorPointer,
      prevCursorPointer: paginatedResult.prevCursorPointer,
    };
  }

  /**
   * List products by category (GSI2: GSI2PK = 'PRODUCT#CATEGORY#{categoryId}', GSI2SK = name)
   */
  async listByCategory(
    categoryId: string,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>> {
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI2',
      direction,
      cursorPointer || ''
    );

    const results = await this.ProductModel.find({ categoryId }, dynamoDbOptions);

    const paginatedResult = pageRecordHandler<ProductDataType>(
      [...results],
      limit,
      direction,
      'GSI2PK',
      'GSI2SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || ''
    );

    return {
      data: paginatedResult.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginatedResult.nextCursorPointer,
      prevCursorPointer: paginatedResult.prevCursorPointer,
    };
  }

  /**
   * Search products by name prefix (GSI4: GSI4PK = 'PRODUCT', GSI4SK = name)
   */
  async searchByName(
    searchTerm: string,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>> {
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(limit, 'GSI4', direction, cursorPointer || '');

    // Use key condition (begins) on GSI4SK instead of filter expression —
    // DynamoDB does not allow key attributes in FilterExpression.
    const results = await this.ProductModel.find(
      { GSI4PK: 'PRODUCT', GSI4SK: { begins: searchTerm } },
      dynamoDbOptions
    );

    const paginatedResult = pageRecordHandler<ProductDataType>(
      [...results],
      limit,
      direction,
      'GSI4PK',
      'GSI4SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || ''
    );

    return {
      data: paginatedResult.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginatedResult.nextCursorPointer,
      prevCursorPointer: paginatedResult.prevCursorPointer,
    };
  }

  /**
   * Check availability for a list of product IDs
   * Returns only products that exist
   */
  async checkAvailability(productIds: string[]): Promise<Product[]> {
    const results = await Promise.all(
      productIds.map((productId) => this.ProductModel.get({ productId }))
    );

    return results
      .filter((result): result is ProductDataType => result !== undefined)
      .map((item) => this.toDomain(item));
  }

  /**
   * Private: Convert DynamoDB record to domain entity
   */
  private toDomain(raw: ProductDataType): Product {
    // dynamodb-onetable adds createdAt/updatedAt when timestamps: true.
    // With isoDates: true, these are returned as Date objects — convert to
    // ISO strings so the domain entity and Zod response schema stay consistent.
    // Guard against undefined: records created before timestamps were enabled
    // (or during local table resets) may lack createdAt/updatedAt entirely.
    // Fall back to a current timestamp so Zod's datetime() never receives undefined.
    const record = raw as ProductDataType & { createdAt?: Date | string; updatedAt?: Date | string };

    const toIsoString = (value: Date | string | undefined, fallback: string): string => {
      if (!value) return fallback;
      return value instanceof Date ? value.toISOString() : value;
    };

    const fallbackNow = new Date().toISOString();

    return Product.reconstitute({
      productId: record.productId,
      name: record.name,
      description: record.description,
      categoryId: record.categoryId,
      price: record.price,
      inventory: record.inventory,
      status: record.status as ProductStatus,
      dateCreated: toIsoString(record.createdAt, fallbackNow),
      updatedAt: toIsoString(record.updatedAt, fallbackNow),
    });
  }

  /**
   * Private: Convert domain entity to database record
   */
  private toPersistence(product: Product): Partial<ProductDataType> {
    const productId = product.getProductId();

    return {
      ...(productId && { productId }),
      name: product.getName(),
      description: product.getDescription(),
      categoryId: product.getCategoryId(),
      price: product.getPrice(),
      inventory: product.getInventory(),
      status: product.getStatus(),
    };
  }
}
