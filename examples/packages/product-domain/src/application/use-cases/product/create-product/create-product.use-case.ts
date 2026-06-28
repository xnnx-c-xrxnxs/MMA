import { IUseCase } from '@old-st/common';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product } from '../../../../domain/entities';
import { InvalidInputError, CategoryNotFoundError } from '../../../exceptions';

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  inventory?: number;
}

export class CreateProductUseCase implements IUseCase<CreateProductInput, Product> {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    if (!input.name) {
      throw new InvalidInputError('Product name is required');
    }

    if (!input.categoryId) {
      throw new InvalidInputError('Category ID is required');
    }

    if (input.price === undefined || input.price === null) {
      throw new InvalidInputError('Product price is required');
    }

    // Verify category exists
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }

    const product = Product.create({
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      inventory: input.inventory,
    });

    return await this.productRepository.save(product);
  }
}
