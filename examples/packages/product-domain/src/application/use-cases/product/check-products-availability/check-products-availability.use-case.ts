import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { InvalidInputError } from '../../../exceptions';

export interface CheckProductsAvailabilityInput {
  productIds: string[];
}

export class CheckProductsAvailabilityUseCase
  implements IUseCase<CheckProductsAvailabilityInput, Product[]>
{
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: CheckProductsAvailabilityInput): Promise<Product[]> {
    if (!input.productIds || input.productIds.length === 0) {
      throw new InvalidInputError('At least one product ID is required');
    }

    return await this.productRepository.checkAvailability(input.productIds);
  }
}
