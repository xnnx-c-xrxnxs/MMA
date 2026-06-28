import { IUseCase } from '@old-st/common';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';

export class DeleteCategoryUseCase implements IUseCase<string, void> {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new CategoryNotFoundError(categoryId);
    }

    // Domain method enforces: cannot delete an already-deleted category
    category.markAsDeleted();

    await this.categoryRepository.save(category);
  }
}
