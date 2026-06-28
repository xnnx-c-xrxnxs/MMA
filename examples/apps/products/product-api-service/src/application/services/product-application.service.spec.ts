import { ProductApplicationService } from './product-application.service';
import { Product } from '@old-st/product-domain';

// Mock the Zod schema parse to pass through
jest.mock('@old-st/contracts/product', () => ({
  ...jest.requireActual('@old-st/contracts/product'),
  productResponseSchema: { parse: jest.fn((input: unknown) => input) },
  categoryResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

function createMockProduct(overrides: Partial<Record<string, unknown>> = {}): Product {
  return Product.reconstitute({
    productId: 'prod-1',
    name: 'Widget',
    description: 'A widget',
    categoryId: 'cat-1',
    price: 10,
    inventory: 100,
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function createMockUseCases() {
  return {
    createProductUseCase: { execute: jest.fn() },
    getProductByIdUseCase: { execute: jest.fn() },
    updateProductDetailsUseCase: { execute: jest.fn() },
    updateProductPriceUseCase: { execute: jest.fn() },
    updateProductInventoryUseCase: { execute: jest.fn() },
    activateProductUseCase: { execute: jest.fn() },
    deactivateProductUseCase: { execute: jest.fn() },
    discontinueProductUseCase: { execute: jest.fn() },
    deleteProductUseCase: { execute: jest.fn() },
    listProductsByStatusUseCase: { execute: jest.fn() },
    listProductsByCategoryUseCase: { execute: jest.fn() },
    searchProductsByNameUseCase: { execute: jest.fn() },
    checkProductsAvailabilityUseCase: { execute: jest.fn() },
  };
}

function createMockEventPublisher() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

describe('ProductApplicationService', () => {
  let service: ProductApplicationService;
  let mocks: ReturnType<typeof createMockUseCases>;
  let mockPublisher: ReturnType<typeof createMockEventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockUseCases();
    mockPublisher = createMockEventPublisher();
    service = new ProductApplicationService(
      mocks.createProductUseCase as any,
      mocks.getProductByIdUseCase as any,
      mocks.updateProductDetailsUseCase as any,
      mocks.updateProductPriceUseCase as any,
      mocks.updateProductInventoryUseCase as any,
      mocks.activateProductUseCase as any,
      mocks.deactivateProductUseCase as any,
      mocks.discontinueProductUseCase as any,
      mocks.deleteProductUseCase as any,
      mocks.listProductsByStatusUseCase as any,
      mocks.listProductsByCategoryUseCase as any,
      mocks.searchProductsByNameUseCase as any,
      mocks.checkProductsAvailabilityUseCase as any,
      mockPublisher as any,
    );
  });

  describe('createProduct', () => {
    it('should delegate to use case and return DTO', async () => {
      const product = createMockProduct();
      mocks.createProductUseCase.execute.mockResolvedValue(product);

      const result = await service.createProduct({
        name: 'Widget',
        description: 'A widget',
        categoryId: 'cat-1',
        price: 10,
        inventory: 100,
      });

      expect(mocks.createProductUseCase.execute).toHaveBeenCalledWith({
        name: 'Widget',
        description: 'A widget',
        categoryId: 'cat-1',
        price: 10,
        inventory: 100,
      });
      expect(result.productId).toBe('prod-1');
    });
  });

  describe('getProductById', () => {
    it('should delegate to use case and return DTO', async () => {
      const product = createMockProduct();
      mocks.getProductByIdUseCase.execute.mockResolvedValue(product);

      const result = await service.getProductById('prod-1');

      expect(result.productId).toBe('prod-1');
    });
  });

  describe('updateProductPrice', () => {
    it('should capture old price, update, and publish PRODUCT_PRICE_CHANGED', async () => {
      const existing = createMockProduct({ price: 10 });
      const updated = createMockProduct({ price: 20 });

      mocks.getProductByIdUseCase.execute.mockResolvedValue(existing);
      mocks.updateProductPriceUseCase.execute.mockResolvedValue(updated);

      const result = await service.updateProductPrice('prod-1', { price: 20 });

      expect(mocks.getProductByIdUseCase.execute).toHaveBeenCalledWith('prod-1');
      expect(mocks.updateProductPriceUseCase.execute).toHaveBeenCalledWith({
        productId: 'prod-1',
        price: 20,
      });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PRODUCT_PRICE_CHANGED',
          productId: 'prod-1',
          oldPrice: 10,
          newPrice: 20,
        }),
      );
      expect(result.productId).toBe('prod-1');
    });
  });

  describe('deactivateProduct', () => {
    it('should deactivate and publish PRODUCT_DEACTIVATED', async () => {
      const product = createMockProduct({ status: 'INACTIVE' });
      mocks.deactivateProductUseCase.execute.mockResolvedValue(product);

      await service.deactivateProduct('prod-1');

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PRODUCT_DEACTIVATED',
          productId: 'prod-1',
        }),
      );
    });
  });

  describe('discontinueProduct', () => {
    it('should discontinue and publish PRODUCT_DISCONTINUED', async () => {
      const product = createMockProduct({ status: 'DISCONTINUED' });
      mocks.discontinueProductUseCase.execute.mockResolvedValue(product);

      await service.discontinueProduct('prod-1');

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PRODUCT_DISCONTINUED',
          productId: 'prod-1',
        }),
      );
    });
  });

  describe('deleteProduct', () => {
    it('should delete and publish PRODUCT_DELETED', async () => {
      mocks.deleteProductUseCase.execute.mockResolvedValue(undefined);

      await service.deleteProduct('prod-1');

      expect(mocks.deleteProductUseCase.execute).toHaveBeenCalledWith('prod-1');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PRODUCT_DELETED',
          productId: 'prod-1',
        }),
      );
    });
  });

  describe('listProductsByStatus', () => {
    it('should route cursor correctly for next direction', async () => {
      mocks.listProductsByStatusUseCase.execute.mockResolvedValue({
        data: [createMockProduct()],
        nextCursorPointer: 'next',
        prevCursorPointer: undefined,
      });

      const result = await service.listProductsByStatus({
        status: 'ACTIVE',
        direction: 'next',
        cursor: 'my-cursor',
        limit: 10,
      });

      expect(mocks.listProductsByStatusUseCase.execute).toHaveBeenCalledWith({
        status: 'ACTIVE',
        limit: 10,
        direction: 'next',
        nextCursorPointer: 'my-cursor',
        prevCursorPointer: undefined,
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('listProductsByCategory', () => {
    it('should pass categoryId and cursor routing', async () => {
      mocks.listProductsByCategoryUseCase.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: undefined,
        prevCursorPointer: undefined,
      });

      await service.listProductsByCategory({
        categoryId: 'cat-1',
        direction: 'next',
        limit: 5,
      });

      expect(mocks.listProductsByCategoryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'cat-1',
          limit: 5,
          direction: 'next',
        }),
      );
    });
  });

  describe('searchProductsByName', () => {
    it('should pass searchTerm and cursor routing', async () => {
      mocks.searchProductsByNameUseCase.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: undefined,
        prevCursorPointer: undefined,
      });

      await service.searchProductsByName({
        searchTerm: 'Widget',
        limit: 20,
        direction: 'next',
      });

      expect(mocks.searchProductsByNameUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'Widget' }),
      );
    });
  });

  describe('checkProductsAvailability', () => {
    it('should map products to availability results', async () => {
      const activeProduct = createMockProduct({ productId: 'p1', status: 'ACTIVE', inventory: 10 });
      const inactiveProduct = createMockProduct({ productId: 'p2', status: 'INACTIVE', inventory: 5 });
      const noStockProduct = createMockProduct({ productId: 'p3', status: 'ACTIVE', inventory: 0 });

      mocks.checkProductsAvailabilityUseCase.execute.mockResolvedValue([
        activeProduct,
        inactiveProduct,
        noStockProduct,
      ]);

      const result = await service.checkProductsAvailability({
        productIds: ['p1', 'p2', 'p3'],
      });

      expect(result).toEqual([
        { productId: 'p1', available: true, inventory: 10, status: 'ACTIVE' },
        { productId: 'p2', available: false, inventory: 5, status: 'INACTIVE' },
        { productId: 'p3', available: false, inventory: 0, status: 'ACTIVE' },
      ]);
    });
  });

  describe('error propagation', () => {
    it('should propagate use case errors', async () => {
      mocks.getProductByIdUseCase.execute.mockRejectedValue(new Error('Not found'));

      await expect(service.getProductById('nonexistent')).rejects.toThrow('Not found');
    });
  });
});
