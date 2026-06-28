import { IPaginatedResponse } from '@old-st/common';
import { Product } from '../../../domain/entities';
import { ProductStatus } from '../../../domain/constants';

export abstract class IProductRepository {
  abstract save(product: Product): Promise<Product>;
  abstract findById(productId: string): Promise<Product | null>;
  abstract listByStatus(
    status: ProductStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>>;
  abstract listByCategory(
    categoryId: string,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>>;
  abstract searchByName(
    searchTerm: string,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<Product>>;
  abstract checkAvailability(productIds: string[]): Promise<Product[]>;
}
