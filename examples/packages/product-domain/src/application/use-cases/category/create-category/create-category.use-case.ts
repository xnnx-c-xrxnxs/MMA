import { IUseCase } from '@old-st/common';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { InvalidInputError, CategoryNameAlreadyExistsError } from '../../../exceptions';

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export class CreateCategoryUseCase implements IUseCase<CreateCategoryInput, ProductCategory> {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<ProductCategory> {
    if (!input.name) {
      throw new InvalidInputError('Category name is required');
    }

    const existing = await this.categoryRepository.findByName(input.name);
    if (existing) {
      throw new CategoryNameAlreadyExistsError(input.name);
    }

    const category = ProductCategory.create({
      name: input.name,
      description: input.description,
    });

    return await this.categoryRepository.save(category);
  }
}
