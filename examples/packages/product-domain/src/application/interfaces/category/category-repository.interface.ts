import { IPaginatedResponse } from '@old-st/common';
import { ProductCategory } from '../../../domain/entities';

export abstract class ICategoryRepository {
  abstract save(category: ProductCategory): Promise<ProductCategory>;
  abstract findById(categoryId: string): Promise<ProductCategory | null>;
  abstract findByName(name: string): Promise<ProductCategory | null>;
  abstract listAll(
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<ProductCategory>>;
}
