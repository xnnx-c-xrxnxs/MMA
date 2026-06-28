import { CategoryStatus, CategoryStatusEnum } from '../../constants';
import {
  InvalidCategoryNameError,
  CannotActivateNonInactiveCategoryError,
  CannotDeactivateNonActiveCategoryError,
  CannotDiscontinueCategoryError,
  CategoryAlreadyDeletedError,
  CannotUpdateDeletedCategoryError,
} from '../../exceptions';

/**
 * ProductCategory Domain Entity
 * Represents a product category that can be assigned to products
 */
export class ProductCategory {
  private constructor(
    private readonly categoryId: string | null,
    private name: string,
    private description: string | undefined,
    private status: CategoryStatus,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  /**
   * Factory: Create a new category (not yet persisted)
   * Default status: ACTIVE
   */
  static create(props: {
    name: string;
    description?: string;
  }): ProductCategory {
    if (props.name.trim().length === 0) {
      throw new InvalidCategoryNameError('Category name cannot be empty');
    }

    const now = new Date().toISOString();

    return new ProductCategory(
      null,
      props.name.trim(),
      props.description?.trim(),
      CategoryStatusEnum.ACTIVE,
      now,
      now
    );
  }

  /**
   * Factory: Reconstitute entity from database
   */
  static reconstitute(props: {
    categoryId: string;
    name: string;
    description: string | undefined;
    status: CategoryStatus;
    dateCreated: string;
    updatedAt: string;
  }): ProductCategory {
    return new ProductCategory(
      props.categoryId,
      props.name,
      props.description,
      props.status,
      props.dateCreated,
      props.updatedAt
    );
  }

  /**
   * Business Logic: Activate category
   * Rule: Can only activate INACTIVE categories
   */
  activate(): void {
    if (this.status !== CategoryStatusEnum.INACTIVE) {
      throw new CannotActivateNonInactiveCategoryError();
    }
    this.status = CategoryStatusEnum.ACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Deactivate category
   * Rule: Can only deactivate ACTIVE categories
   */
  deactivate(): void {
    if (this.status !== CategoryStatusEnum.ACTIVE) {
      throw new CannotDeactivateNonActiveCategoryError();
    }
    this.status = CategoryStatusEnum.INACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Discontinue category
   * Rule: Can only discontinue ACTIVE or INACTIVE categories
   */
  discontinue(): void {
    if (
      this.status !== CategoryStatusEnum.ACTIVE &&
      this.status !== CategoryStatusEnum.INACTIVE
    ) {
      throw new CannotDiscontinueCategoryError();
    }
    this.status = CategoryStatusEnum.DISCONTINUED;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Soft delete category
   * Rule: Cannot delete already DELETED categories
   */
  markAsDeleted(): void {
    if (this.status === CategoryStatusEnum.DELETED) {
      throw new CategoryAlreadyDeletedError();
    }
    this.status = CategoryStatusEnum.DELETED;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Update category details
   * Rule: Cannot update DELETED categories
   */
  updateDetails(name: string, description?: string): void {
    if (this.status === CategoryStatusEnum.DELETED) {
      throw new CannotUpdateDeletedCategoryError();
    }

    if (name.trim().length === 0) {
      throw new InvalidCategoryNameError('Category name cannot be empty');
    }

    this.name = name.trim();
    this.description = description?.trim();
    this.updatedAt = new Date().toISOString();
  }

  // Status helpers
  isActive(): boolean {
    return this.status === CategoryStatusEnum.ACTIVE;
  }

  isInactive(): boolean {
    return this.status === CategoryStatusEnum.INACTIVE;
  }

  isDiscontinued(): boolean {
    return this.status === CategoryStatusEnum.DISCONTINUED;
  }

  isDeleted(): boolean {
    return this.status === CategoryStatusEnum.DELETED;
  }

  // Getters
  getCategoryId(): string | null {
    return this.categoryId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getStatus(): CategoryStatus {
    return this.status;
  }

  getDateCreated(): string {
    return this.dateCreated;
  }

  getUpdatedAt(): string {
    return this.updatedAt;
  }

}
