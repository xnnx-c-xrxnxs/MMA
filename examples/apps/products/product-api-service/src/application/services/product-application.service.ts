import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IPaginatedResponse, IEventPublisher } from '@old-st/common';

const logger = createLogger('product-api-service');
import {
  productResponseSchema,
  categoryResponseSchema,
  CreateProductInput,
  UpdateProductDetailsInput,
  UpdateProductPriceInput,
  UpdateProductInventoryInput,
  ListProductsByStatusInput,
  ListProductsByCategoryInput,
  SearchProductsByNameInput,
  CheckProductsAvailabilityInput,
  ProductResponse,
  ProductAvailabilityResult,
} from '@old-st/contracts/product';
import { PaginatedResponse } from '@old-st/contracts/common';
import {
  Product,
  CreateProductUseCase,
  GetProductByIdUseCase,
  UpdateProductDetailsUseCase,
  UpdateProductPriceUseCase,
  UpdateProductInventoryUseCase,
  ActivateProductUseCase,
  DeactivateProductUseCase,
  DiscontinueProductUseCase,
  DeleteProductUseCase,
  ListProductsByStatusUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsByNameUseCase,
  CheckProductsAvailabilityUseCase,
  ProductEventTypeEnum,
} from '@old-st/product-domain';
import type { ProductDomainEventPayload } from '@old-st/product-domain';

@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly updateProductDetailsUseCase: UpdateProductDetailsUseCase,
    private readonly updateProductPriceUseCase: UpdateProductPriceUseCase,
    private readonly updateProductInventoryUseCase: UpdateProductInventoryUseCase,
    private readonly activateProductUseCase: ActivateProductUseCase,
    private readonly deactivateProductUseCase: DeactivateProductUseCase,
    private readonly discontinueProductUseCase: DiscontinueProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly listProductsByStatusUseCase: ListProductsByStatusUseCase,
    private readonly listProductsByCategoryUseCase: ListProductsByCategoryUseCase,
    private readonly searchProductsByNameUseCase: SearchProductsByNameUseCase,
    private readonly checkProductsAvailabilityUseCase: CheckProductsAvailabilityUseCase,
    @Inject('PRODUCT_EVENT_PUBLISHER')
    private readonly eventPublisher: IEventPublisher<ProductDomainEventPayload>,
  ) {}

  private toDto(product: Product): ProductResponse {
    return productResponseSchema.parse({
      productId: product.getProductId(),
      name: product.getName(),
      description: product.getDescription(),
      categoryId: product.getCategoryId(),
      price: product.getPrice(),
      inventory: product.getInventory(),
      status: product.getStatus(),
      dateCreated: product.getDateCreated(),
      updatedAt: product.getUpdatedAt(),
    });
  }

  private toPaginatedDto(
    result: IPaginatedResponse<Product>
  ): PaginatedResponse<ProductResponse> {
    return {
      data: result.data.map((product) => this.toDto(product)),
      nextCursorPointer: result.nextCursorPointer,
      prevCursorPointer: result.prevCursorPointer,
    };
  }

  async createProduct(input: CreateProductInput): Promise<ProductResponse> {
    logger.info('Creating product', { name: input.name, categoryId: input.categoryId, price: input.price });
    const product = await this.createProductUseCase.execute({
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      inventory: input.inventory,
    });
    logger.info('Product created', { productId: product.getProductId(), name: product.getName(), categoryId: product.getCategoryId() });
    return this.toDto(product);
  }

  async getProductById(productId: string): Promise<ProductResponse> {
    const product = await this.getProductByIdUseCase.execute(productId);
    return this.toDto(product);
  }

  async updateProductDetails(
    productId: string,
    input: UpdateProductDetailsInput
  ): Promise<ProductResponse> {
    logger.info('Updating product details', { productId, fields: Object.keys(input).filter(k => (input as Record<string,unknown>)[k] !== undefined) });
    const product = await this.updateProductDetailsUseCase.execute({
      productId,
      ...input,
    });
    logger.info('Product details updated', { productId: product.getProductId() });
    return this.toDto(product);
  }

  async updateProductPrice(
    productId: string,
    input: UpdateProductPriceInput
  ): Promise<ProductResponse> {
    // Capture old price before the update for the event payload
    const existing = await this.getProductByIdUseCase.execute(productId);
    const oldPrice = existing.getPrice();
    logger.info('Updating product price', { productId, oldPrice, newPrice: input.price });
    const product = await this.updateProductPriceUseCase.execute({
      productId,
      price: input.price,
    });
    logger.info('Product price updated — publishing PRODUCT_PRICE_CHANGED event', { productId: product.getProductId(), oldPrice, newPrice: input.price });
    await this.eventPublisher.publish({
      eventType: ProductEventTypeEnum.PRODUCT_PRICE_CHANGED,
      productId: product.getProductId() as string,
      oldPrice,
      newPrice: input.price,
      occurredAt: new Date().toISOString(),
    }, { groupId: product.getProductId() as string });
    return this.toDto(product);
  }

  async updateProductInventory(
    productId: string,
    input: UpdateProductInventoryInput
  ): Promise<ProductResponse> {
    logger.info('Updating product inventory', { productId, inventory: input.inventory });
    const product = await this.updateProductInventoryUseCase.execute({
      productId,
      inventory: input.inventory,
    });
    logger.info('Product inventory updated', { productId: product.getProductId(), inventory: product.getInventory() });
    return this.toDto(product);
  }

  async activateProduct(productId: string): Promise<ProductResponse> {
    logger.info('Activating product', { productId });
    const product = await this.activateProductUseCase.execute(productId);
    logger.info('Product activated', { productId: product.getProductId(), status: product.getStatus() });
    return this.toDto(product);
  }

  async deactivateProduct(productId: string): Promise<ProductResponse> {
    logger.info('Deactivating product', { productId });
    const product = await this.deactivateProductUseCase.execute(productId);
    logger.info('Product deactivated — publishing PRODUCT_DEACTIVATED event', { productId: product.getProductId() });
    await this.eventPublisher.publish({
      eventType: ProductEventTypeEnum.PRODUCT_DEACTIVATED,
      productId: product.getProductId() as string,
      occurredAt: new Date().toISOString(),
    }, { groupId: product.getProductId() as string });
    return this.toDto(product);
  }

  async discontinueProduct(productId: string): Promise<ProductResponse> {
    logger.info('Discontinuing product', { productId });
    const product = await this.discontinueProductUseCase.execute(productId);
    logger.info('Product discontinued — publishing PRODUCT_DISCONTINUED event', { productId: product.getProductId() });
    await this.eventPublisher.publish({
      eventType: ProductEventTypeEnum.PRODUCT_DISCONTINUED,
      productId: product.getProductId() as string,
      occurredAt: new Date().toISOString(),
    }, { groupId: product.getProductId() as string });
    return this.toDto(product);
  }

  async deleteProduct(productId: string): Promise<void> {
    logger.info('Deleting product', { productId });
    await this.deleteProductUseCase.execute(productId);
    logger.info('Product deleted — publishing PRODUCT_DELETED event', { productId });
    await this.eventPublisher.publish({
      eventType: ProductEventTypeEnum.PRODUCT_DELETED,
      productId,
      occurredAt: new Date().toISOString(),
    }, { groupId: productId });
  }

  async listProductsByStatus(
    input: ListProductsByStatusInput
  ): Promise<PaginatedResponse<ProductResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.listProductsByStatusUseCase.execute({
      status: input.status,
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async listProductsByCategory(
    input: ListProductsByCategoryInput
  ): Promise<PaginatedResponse<ProductResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.listProductsByCategoryUseCase.execute({
      categoryId: input.categoryId,
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async searchProductsByName(
    input: SearchProductsByNameInput
  ): Promise<PaginatedResponse<ProductResponse>> {
    const direction = input.direction ?? 'next';
    const result = await this.searchProductsByNameUseCase.execute({
      searchTerm: input.searchTerm,
      limit: input.limit || 20,
      direction,
      nextCursorPointer: direction === 'next' ? input.cursor : undefined,
      prevCursorPointer: direction === 'prev' ? input.cursor : undefined,
    });
    return this.toPaginatedDto(result);
  }

  async checkProductsAvailability(
    input: CheckProductsAvailabilityInput
  ): Promise<ProductAvailabilityResult[]> {
    const products = await this.checkProductsAvailabilityUseCase.execute({
      productIds: input.productIds,
    });

    return products.map((product) => ({
      productId: product.getProductId() as string,
      available: product.isActive() && product.getInventory() > 0,
      inventory: product.getInventory(),
      status: product.getStatus(),
    }));
  }
}
