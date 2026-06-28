import { IUseCase } from '@old-st/common';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';

export interface UpdateCategoryInput {
  categoryId: string;
  name: string;
  description?: string;
}

export class UpdateCategoryUseCase implements IUseCase<UpdateCategoryInput, ProductCategory> {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(input: UpdateCategoryInput): Promise<ProductCategory> {
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }

    category.updateDetails(input.name, input.description);
    return await this.categoryRepository.save(category);
  }
}
