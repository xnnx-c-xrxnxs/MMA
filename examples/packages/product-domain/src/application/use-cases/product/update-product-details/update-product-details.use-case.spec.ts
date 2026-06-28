import { UpdateProductDetailsUseCase } from './update-product-details.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product, ProductCategory } from '../../../../domain/entities';
import { ProductNotFoundError, CategoryNotFoundError } from '../../../exceptions';
import {
  CannotUpdateDeletedProductError,
  CannotUpdateDiscontinuedProductError,
} from '../../../../domain/exceptions';

function createMockProductRepository() {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    listByStatus: jest.fn(),
    listByCategory: jest.fn(),
    searchByName: jest.fn(),
    checkAvailability: jest.fn(),
  } as unknown as jest.Mocked<IProductRepository>;
}

function createMockCategoryRepository() {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    listAll: jest.fn(),
  } as unknown as jest.Mocked<ICategoryRepository>;
}

const makeActiveProduct = (overrides = {}) =>
  Product.reconstitute({
    productId: 'prod-123',
    name: 'Test Product',
    description: 'A test product',
    categoryId: 'cat-123',
    price: 29.99,
    inventory: 100,
    status: 'ACTIVE',
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

const makeActiveCategory = (overrides = {}) =>
  ProductCategory.reconstitute({
    categoryId: 'cat-456',
    name: 'Electronics',
    description: 'Electronic devices',
    status: 'ACTIVE',
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

describe('UpdateProductDetailsUseCase', () => {
  let useCase: UpdateProductDetailsUseCase;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductRepo = createMockProductRepository();
    mockCategoryRepo = createMockCategoryRepository();
    useCase = new UpdateProductDetailsUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('should update product details and persist', async () => {
    const product = makeActiveProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockProductRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({
      productId: 'prod-123',
      name: 'Updated Name',
      description: 'Updated description',
    });

    expect(result.getName()).toBe('Updated Name');
    expect(result.getDescription()).toBe('Updated description');
    expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should verify new categoryId exists when provided', async () => {
    const product = makeActiveProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());
    mockProductRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({
      productId: 'prod-123',
      categoryId: 'cat-456',
    });

    expect(result.getCategoryId()).toBe('cat-456');
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith('cat-456');
    expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: 'prod-missing', name: 'New Name' })
    ).rejects.toThrow(ProductNotFoundError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CategoryNotFoundError when new categoryId does not exist', async () => {
    const product = makeActiveProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockCategoryRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: 'prod-123', categoryId: 'cat-nonexistent' })
    ).rejects.toThrow(CategoryNotFoundError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotUpdateDeletedProductError when product is DELETED', async () => {
    const product = makeActiveProduct({ status: 'DELETED' });
    mockProductRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', name: 'New Name' })
    ).rejects.toThrow(CannotUpdateDeletedProductError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotUpdateDiscontinuedProductError when product is DISCONTINUED', async () => {
    const product = makeActiveProduct({ status: 'DISCONTINUED' });
    mockProductRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', name: 'New Name' })
    ).rejects.toThrow(CannotUpdateDiscontinuedProductError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });
});
