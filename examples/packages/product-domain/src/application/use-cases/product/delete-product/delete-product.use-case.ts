import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ProductNotFoundError } from '../../../exceptions';

export class DeleteProductUseCase implements IUseCase<string, void> {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(productId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    product.markAsDeleted();
    await this.productRepository.save(product);
  }
}
