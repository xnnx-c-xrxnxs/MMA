import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';

export interface UpdateProductPriceInput {
  productId: string;
  price: number;
}

export class UpdateProductPriceUseCase implements IUseCase<UpdateProductPriceInput, Product> {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: UpdateProductPriceInput): Promise<Product> {
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError(input.productId);
    }

    product.updatePrice(input.price);
    return await this.productRepository.save(product);
  }
}
