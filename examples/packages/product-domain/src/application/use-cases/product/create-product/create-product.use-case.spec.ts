import { CreateProductUseCase } from './create-product.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { Product, ProductCategory } from '../../../../domain/entities';
import { InvalidInputError, CategoryNotFoundError } from '../../../exceptions';
import {
  InvalidProductNameError,
  InvalidProductPriceError,
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

describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductRepo = createMockProductRepository();
    mockCategoryRepo = createMockCategoryRepository();
    useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('should create and persist the product', async () => {
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());
    mockProductRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({
      name: 'Test Product',
      description: 'A test product',
      categoryId: 'cat-123',
      price: 29.99,
      inventory: 100,
    });

    expect(result).toBeInstanceOf(Product);
    expect(result.getName()).toBe('Test Product');
    expect(result.getPrice()).toBe(29.99);
    expect(result.getInventory()).toBe(100);
    expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith('cat-123');
  });

  it('should throw InvalidInputError when name is missing', async () => {
    await expect(
      useCase.execute({
        name: '',
        categoryId: 'cat-123',
        price: 29.99,
      })
    ).rejects.toThrow(InvalidInputError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when categoryId is missing', async () => {
    await expect(
      useCase.execute({
        name: 'Test Product',
        categoryId: '',
        price: 29.99,
      })
    ).rejects.toThrow(InvalidInputError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when price is missing', async () => {
    await expect(
      useCase.execute({
        name: 'Test Product',
        categoryId: 'cat-123',
        price: undefined as unknown as number,
      })
    ).rejects.toThrow(InvalidInputError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CategoryNotFoundError when category does not exist', async () => {
    mockCategoryRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        name: 'Test Product',
        categoryId: 'cat-nonexistent',
        price: 29.99,
      })
    ).rejects.toThrow(CategoryNotFoundError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductNameError when name is only whitespace', async () => {
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());

    await expect(
      useCase.execute({
        name: '   ',
        categoryId: 'cat-123',
        price: 29.99,
      })
    ).rejects.toThrow(InvalidProductNameError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductPriceError when price is zero', async () => {
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());

    await expect(
      useCase.execute({
        name: 'Test Product',
        categoryId: 'cat-123',
        price: 0,
      })
    ).rejects.toThrow(InvalidProductPriceError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductPriceError when price is negative', async () => {
    mockCategoryRepo.findById.mockResolvedValue(makeActiveCategory());

    await expect(
      useCase.execute({
        name: 'Test Product',
        categoryId: 'cat-123',
        price: -10,
      })
    ).rejects.toThrow(InvalidProductPriceError);

    expect(mockProductRepo.save).not.toHaveBeenCalled();
  });
});
