import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';

export interface UpdateProductInventoryInput {
  productId: string;
  inventory: number;
}

export class UpdateProductInventoryUseCase implements IUseCase<UpdateProductInventoryInput, Product> {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: UpdateProductInventoryInput): Promise<Product> {
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError(input.productId);
    }

    product.updateInventory(input.inventory);
    return await this.productRepository.save(product);
  }
}
