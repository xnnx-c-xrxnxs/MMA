import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductStatus, PRODUCT_STATUSES } from '../../../../domain/constants';
import { InvalidInputError } from '../../../exceptions';

export interface ListProductsByStatusInput {
  status: ProductStatus;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListProductsByStatusUseCase
  implements IUseCase<ListProductsByStatusInput, IPaginatedResponse<Product>>
{
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(
    input: ListProductsByStatusInput
  ): Promise<IPaginatedResponse<Product>> {
    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }

    if (!PRODUCT_STATUSES.includes(input.status)) {
      throw new InvalidInputError(`Invalid product status: ${input.status}`);
    }

    return await this.productRepository.listByStatus(
      input.status,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer
    );
  }
}
