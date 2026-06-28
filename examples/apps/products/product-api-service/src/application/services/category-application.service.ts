import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IPaginatedResponse } from '@old-st/common';

const logger = createLogger('product-api-service');
import {
  categoryResponseSchema,
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesInput,
  CategoryResponse,
} from '@old-st/contracts/product';
import { PaginatedResponse } from '@old-st/contracts/common';
import {
  ProductCategory,
  CreateCategoryUseCase,
  GetCategoryByIdUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '@old-st/product-domain';

@Injectable()
export class CategoryApplicationService {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
  ) {}

  private toDto(category: ProductCategory): CategoryResponse {
    return categoryResponseSchema.parse({
      categoryId: category.getCategoryId(),
      name: category.getName(),
      description: category.getDescription(),
      status: category.getStatus(),
      dateCreated: category.getDateCreated(),
      updatedAt: category.getUpdatedAt(),
    });
  }

  private toPaginatedDto(
    result: IPaginatedResponse<ProductCategory>
  ): PaginatedResponse<CategoryResponse> {
    return {
      data: result.data.map((category) => this.toDto(category)),
      nextCursorPointer: result.nextCursorPointer,
      prevCursorPointer: result.prevCursorPointer,
    };
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryResponse> {
    logger.info('Creating category', { name: input.name });
    const category = await this.createCategoryUseCase.execute({
      name: input.name,
      description: input.description,
    });
    logger.info('Category created', { categoryId: category.getCategoryId(), name: category.getName() });
    return this.toDto(category);
  }

  async getCategoryById(categoryId: string): Promise<CategoryResponse> {
    const category = await this.getCategoryByIdUseCase.execute(categoryId);
    return this.toDto(category);
  }

  async listCategories(
    input: ListCategoriesInput
  ): Promise<PaginatedResponse<CategoryResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.listCategoriesUseCase.execute({
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async updateCategory(
    categoryId: string,
    input: UpdateCategoryInput
  ): Promise<CategoryResponse> {
    logger.info('Updating category', { categoryId, fields: Object.keys(input).filter(k => (input as Record<string,unknown>)[k] !== undefined) });
    const category = await this.updateCategoryUseCase.execute({
      categoryId,
      name: input.name,
      description: input.description,
    });
    logger.info('Category updated', { categoryId: category.getCategoryId() });
    return this.toDto(category);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    logger.info('Deleting category', { categoryId });
    await this.deleteCategoryUseCase.execute(categoryId);
    logger.info('Category deleted', { categoryId });
  }
}
