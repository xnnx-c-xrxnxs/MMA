import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { InvalidInputError } from '../../../exceptions';

export interface SearchProductsByNameInput {
  searchTerm: string;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class SearchProductsByNameUseCase
  implements IUseCase<SearchProductsByNameInput, IPaginatedResponse<Product>>
{
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(
    input: SearchProductsByNameInput
  ): Promise<IPaginatedResponse<Product>> {
    if (!input.searchTerm || input.searchTerm.trim().length === 0) {
      throw new InvalidInputError('Search term is required');
    }

    return await this.productRepository.searchByName(
      input.searchTerm.trim(),
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
