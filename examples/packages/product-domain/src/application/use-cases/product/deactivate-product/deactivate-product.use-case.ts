import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';

export class DeactivateProductUseCase implements IUseCase<string, Product> {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    product.deactivate();
    return await this.productRepository.save(product);
  }
}
