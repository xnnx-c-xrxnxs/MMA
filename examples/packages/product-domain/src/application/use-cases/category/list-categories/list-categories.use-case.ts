import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';

export interface ListCategoriesInput {
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListCategoriesUseCase
  implements IUseCase<ListCategoriesInput, IPaginatedResponse<ProductCategory>>
{
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(
    input: ListCategoriesInput
  ): Promise<IPaginatedResponse<ProductCategory>> {
    return await this.categoryRepository.listAll(
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
