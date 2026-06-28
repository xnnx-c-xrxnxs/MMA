import {
  ProductStatusEnum,
  CategoryStatusEnum,
  type ProductStatus,
  type CategoryStatus,
} from '@old-st/contracts/product';
import { formatStatus } from '../format-status';

const productLabels: Record<ProductStatus, string> = {
  [ProductStatusEnum.ACTIVE]: 'Active',
  [ProductStatusEnum.INACTIVE]: 'Inactive',
  [ProductStatusEnum.DISCONTINUED]: 'Discontinued',
  [ProductStatusEnum.DELETED]: 'Deleted',
};

const categoryLabels: Record<CategoryStatus, string> = {
  [CategoryStatusEnum.ACTIVE]: 'Active',
  [CategoryStatusEnum.INACTIVE]: 'Inactive',
  [CategoryStatusEnum.DISCONTINUED]: 'Discontinued',
  [CategoryStatusEnum.DELETED]: 'Deleted',
};

export function formatProductStatus(status: ProductStatus): string {
  return formatStatus(status, productLabels);
}

export function formatCategoryStatus(status: CategoryStatus): string {
  return formatStatus(status, categoryLabels);
}
