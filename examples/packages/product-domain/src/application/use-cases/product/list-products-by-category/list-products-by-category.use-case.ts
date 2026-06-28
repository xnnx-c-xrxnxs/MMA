import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product } from '../../../../domain/entities';
import { InvalidInputError, CategoryNotFoundError } from '../../../exceptions';

export interface ListProductsByCategoryInput {
  categoryId: string;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListProductsByCategoryUseCase
  implements IUseCase<ListProductsByCategoryInput, IPaginatedResponse<Product>>
{
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  async execute(
    input: ListProductsByCategoryInput
  ): Promise<IPaginatedResponse<Product>> {
    if (!input.categoryId) {
      throw new InvalidInputError('Category ID is required');
    }

    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }

    return await this.productRepository.listByCategory(
      input.categoryId,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
