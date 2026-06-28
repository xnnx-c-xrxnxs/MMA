import { IUseCase } from '@old-st/common';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';

export class GetCategoryByIdUseCase implements IUseCase<string, ProductCategory> {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(categoryId: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new CategoryNotFoundError(categoryId);
    }
    return category;
  }
}
