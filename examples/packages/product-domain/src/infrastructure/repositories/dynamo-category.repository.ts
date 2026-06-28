import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@old-st/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@old-st/dynamodb-onetable';
import { ICategoryRepository } from '../../application/interfaces/category/category-repository.interface';
import { ProductCategory } from '../../domain/entities';
import { CategoryDataType } from '../schemas/ProductSchema';

/**
 * Local structural interface for the dynamodb-onetable Model instance.
 */
interface ICategoryModel {
  create(properties: object): Promise<CategoryDataType>;
  upsert(properties: object): Promise<CategoryDataType>;
  get(properties: object, options?: object): Promise<CategoryDataType | undefined>;
  find(properties: object, options?: object): Promise<CategoryDataType[]>;
}

export class DynamoCategoryRepository implements ICategoryRepository {
  private readonly CategoryModel: ICategoryModel;

  constructor(private readonly table: Table) {
    this.CategoryModel = this.table.getModel('Category') as unknown as ICategoryModel;
  }

  /**
   * Save a category entity (create or update)
   */
  async save(category: ProductCategory): Promise<ProductCategory> {
    const data = this.toPersistence(category);

    if (category.getCategoryId()) {
      const updated = await this.CategoryModel.upsert(data);
      return this.toDomain(updated);
    } else {
      const created = await this.CategoryModel.create(data);
      return this.toDomain(created);
    }
  }

  /**
   * Find category by ID (Primary Key)
   */
  async findById(categoryId: string): Promise<ProductCategory | null> {
    const result = await this.CategoryModel.get({ categoryId });
    return result ? this.toDomain(result) : null;
  }

  /**
   * Find category by name (GSI1 overloaded: GSI1PK = 'CATEGORY', GSI1SK = name)
   */
  async findByName(name: string): Promise<ProductCategory | null> {
    const results = await this.CategoryModel.find(
      { name },
      { index: 'GSI1', limit: 1 }
    );

    return results.length > 0 ? this.toDomain(results[0]) : null;
  }

  /**
   * List all categories sorted by name (GSI1 overloaded: GSI1PK = 'CATEGORY')
   * GSI1 is shared with products; no collision because Product uses 'PRODUCT#${status}'
   * as its GSI1PK, while Category uses the distinct value 'CATEGORY'.
   */
  async listAll(
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<ProductCategory>> {
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI1',
      direction,
      cursorPointer || ''
    );

    // GSI1PK is always 'CATEGORY' so we query with an empty object (value template resolves it)
    const results = await this.CategoryModel.find({}, dynamoDbOptions);

    const paginatedResult = pageRecordHandler<CategoryDataType>(
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
   * Private: Convert DynamoDB record to domain entity
   */
  private toDomain(raw: CategoryDataType): ProductCategory {
    // dynamodb-onetable adds createdAt/updatedAt when timestamps: true.
    // With isoDates: true these come back as Date objects — convert to ISO strings.
    // Guard against undefined for records created before timestamps were enabled.
    const record = raw as CategoryDataType & { createdAt?: Date | string; updatedAt?: Date | string };

    const toIsoString = (value: Date | string | undefined, fallback: string): string => {
      if (!value) return fallback;
      return value instanceof Date ? value.toISOString() : value;
    };

    const fallbackNow = new Date().toISOString();

    return ProductCategory.reconstitute({
      categoryId: record.categoryId,
      name: record.name,
      description: record.description,
      status: record.status,
      dateCreated: toIsoString(record.createdAt, fallbackNow),
      updatedAt: toIsoString(record.updatedAt, fallbackNow),
    });
  }

  /**
   * Private: Convert domain entity to database record
   */
  private toPersistence(category: ProductCategory): Partial<CategoryDataType> {
    const categoryId = category.getCategoryId();

    return {
      ...(categoryId && { categoryId }),
      name: category.getName(),
      description: category.getDescription(),
      status: category.getStatus(),
    };
  }
}
