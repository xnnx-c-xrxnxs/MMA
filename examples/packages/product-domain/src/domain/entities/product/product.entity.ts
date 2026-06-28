import { ProductStatus, ProductStatusEnum } from '../../constants';
import {
  CannotActivateNonInactiveProductError,
  CannotDeactivateNonActiveProductError,
  CannotDiscontinueProductError,
  ProductAlreadyDeletedError,
  CannotUpdateDeletedProductError,
  CannotUpdateDiscontinuedProductError,
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductInventoryError,
} from '../../exceptions';

/**
 * Product Domain Entity
 * Contains business logic and rules for product management
 */
export class Product {
  private constructor(
    private readonly productId: string | null,
    private name: string,
    private description: string | undefined,
    private categoryId: string,
    private price: number,
    private inventory: number,
    private status: ProductStatus,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  /**
   * Factory: Create a new product (not yet persisted)
   */
  static create(props: {
    name: string;
    description?: string;
    categoryId: string;
    price: number;
    inventory?: number;
  }): Product {
    if (props.name.trim().length === 0) {
      throw new InvalidProductNameError('Product name cannot be empty');
    }

    if (props.price <= 0) {
      throw new InvalidProductPriceError('Price must be greater than 0');
    }

    const inventory = props.inventory ?? 0;
    if (inventory < 0) {
      throw new InvalidProductInventoryError('Inventory cannot be negative');
    }

    const now = new Date().toISOString();

    return new Product(
      null,
      props.name.trim(),
      props.description?.trim(),
      props.categoryId,
      props.price,
      inventory,
      ProductStatusEnum.ACTIVE,
      now,
      now
    );
  }

  /**
   * Factory: Reconstitute entity from database
   */
  static reconstitute(props: {
    productId: string;
    name: string;
    description: string | undefined;
    categoryId: string;
    price: number;
    inventory: number;
    status: ProductStatus;
    dateCreated: string;
    updatedAt: string;
  }): Product {
    return new Product(
      props.productId,
      props.name,
      props.description,
      props.categoryId,
      props.price,
      props.inventory,
      props.status,
      props.dateCreated,
      props.updatedAt
    );
  }

  /**
   * Business Logic: Activate product
   * Rule: Can only activate INACTIVE products
   */
  activate(): void {
    if (this.status !== ProductStatusEnum.INACTIVE) {
      throw new CannotActivateNonInactiveProductError();
    }
    this.status = ProductStatusEnum.ACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Deactivate product
   * Rule: Can only deactivate ACTIVE products
   */
  deactivate(): void {
    if (this.status !== ProductStatusEnum.ACTIVE) {
      throw new CannotDeactivateNonActiveProductError();
    }
    this.status = ProductStatusEnum.INACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Discontinue product
   * Rule: Can only discontinue ACTIVE or INACTIVE products
   */
  discontinue(): void {
    if (
      this.status !== ProductStatusEnum.ACTIVE &&
      this.status !== ProductStatusEnum.INACTIVE
    ) {
      throw new CannotDiscontinueProductError();
    }
    this.status = ProductStatusEnum.DISCONTINUED;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Soft delete product
   * Rule: Cannot delete already DELETED products
   */
  markAsDeleted(): void {
    if (this.status === ProductStatusEnum.DELETED) {
      throw new ProductAlreadyDeletedError();
    }
    this.status = ProductStatusEnum.DELETED;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Update product details (name, description, categoryId)
   * Rule: Updates only allowed on ACTIVE products
   */
  updateDetails(name?: string, description?: string, categoryId?: string): void {
    if (this.status === ProductStatusEnum.DELETED) {
      throw new CannotUpdateDeletedProductError('details');
    }

    if (this.status === ProductStatusEnum.DISCONTINUED) {
      throw new CannotUpdateDiscontinuedProductError('details');
    }

    if (name !== undefined) {
      if (name.trim().length === 0) {
        throw new InvalidProductNameError('Product name cannot be empty');
      }
      this.name = name.trim();
    }

    if (description !== undefined) {
      this.description = description.trim();
    }

    if (categoryId !== undefined) {
      this.categoryId = categoryId;
    }

    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Update product price
   * Rule: Cannot update price of DELETED or DISCONTINUED products
   */
  updatePrice(price: number): void {
    if (this.status === ProductStatusEnum.DELETED) {
      throw new CannotUpdateDeletedProductError('price');
    }

    if (this.status === ProductStatusEnum.DISCONTINUED) {
      throw new CannotUpdateDiscontinuedProductError('price');
    }

    if (price <= 0) {
      throw new InvalidProductPriceError('Price must be greater than 0');
    }

    this.price = price;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Business Logic: Update product inventory
   * Rule: Cannot update inventory of DELETED or DISCONTINUED products
   */
  updateInventory(inventory: number): void {
    if (this.status === ProductStatusEnum.DELETED) {
      throw new CannotUpdateDeletedProductError('inventory');
    }

    if (this.status === ProductStatusEnum.DISCONTINUED) {
      throw new CannotUpdateDiscontinuedProductError('inventory');
    }

    if (inventory < 0) {
      throw new InvalidProductInventoryError('Inventory cannot be negative');
    }

    this.inventory = inventory;
    this.updatedAt = new Date().toISOString();
  }

  // Status helpers
  isActive(): boolean {
    return this.status === ProductStatusEnum.ACTIVE;
  }

  isInactive(): boolean {
    return this.status === ProductStatusEnum.INACTIVE;
  }

  isDiscontinued(): boolean {
    return this.status === ProductStatusEnum.DISCONTINUED;
  }

  isDeleted(): boolean {
    return this.status === ProductStatusEnum.DELETED;
  }

  // Getters
  getProductId(): string | null {
    return this.productId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getCategoryId(): string {
    return this.categoryId;
  }

  getPrice(): number {
    return this.price;
  }

  getInventory(): number {
    return this.inventory;
  }

  getStatus(): ProductStatus {
    return this.status;
  }

  getDateCreated(): string {
    return this.dateCreated;
  }

  getUpdatedAt(): string {
    return this.updatedAt;
  }

}
