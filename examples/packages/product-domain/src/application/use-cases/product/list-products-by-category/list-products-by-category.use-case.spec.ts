import { ListProductsByCategoryUseCase } from './list-products-by-category.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product, ProductCategory } from '../../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';
import { InvalidInputError, CategoryNotFoundError } from '../../../exceptions';

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
    categoryId: 'cat-123',
    name: 'Electronics',
    description: 'Electronic devices',
    status: 'ACTIVE',
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

describe('ListProductsByCategoryUseCase', () => {
  let useCase: ListProductsByCategoryUseCase;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductRepo = createMockProductRepository();
    mockCategoryRepo = createMockCategoryRepository();
    useCase = new ListProductsByCategoryUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('should return paginated products by category', async () => {
    const paginatedResult: IPaginatedResponse<Product> = {
      data: [makeActiveProduct()],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());
    mockProductRepo.listByCategory.mockResolvedValue(paginatedResult);

    const result = await useCase.execute({ categoryId: 'cat-123' });

    expect(result.data).toHaveLength(1);
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith('cat-123');
    expect(mockProductRepo.listByCategory).toHaveBeenCalledWith(
      'cat-123',
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('should throw InvalidInputError when categoryId is empty', async () => {
    await expect(
      useCase.execute({ categoryId: '' })
    ).rejects.toThrow(InvalidInputError);

    expect(mockProductRepo.listByCategory).not.toHaveBeenCalled();
  });

  it('should throw CategoryNotFoundError when category does not exist', async () => {
    mockCategoryRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ categoryId: 'cat-nonexistent' })
    ).rejects.toThrow(CategoryNotFoundError);

    expect(mockProductRepo.listByCategory).not.toHaveBeenCalled();
  });
});
