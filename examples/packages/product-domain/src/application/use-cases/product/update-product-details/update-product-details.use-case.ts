import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError, CategoryNotFoundError } from '../../../exceptions';

export interface UpdateProductDetailsInput {
  productId: string;
  name?: string;
  description?: string;
  categoryId?: string;
}

export class UpdateProductDetailsUseCase implements IUseCase<UpdateProductDetailsInput, Product> {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  async execute(input: UpdateProductDetailsInput): Promise<Product> {
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError(input.productId);
    }

    // Verify new categoryId exists if provided
    if (input.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new CategoryNotFoundError(input.categoryId);
      }
    }

    product.updateDetails(input.name, input.description, input.categoryId);
    return await this.productRepository.save(product);
  }
}
