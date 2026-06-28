import { UpdateProductPriceUseCase } from './update-product-price.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';
import {
  CannotUpdateDeletedProductError,
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

describe('UpdateProductPriceUseCase', () => {
  let useCase: UpdateProductPriceUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new UpdateProductPriceUseCase(mockRepo);
  });

  it('should update the product price and persist', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);
    mockRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({ productId: 'prod-123', price: 49.99 });

    expect(result.getPrice()).toBe(49.99);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: 'prod-missing', price: 49.99 })
    ).rejects.toThrow(ProductNotFoundError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotUpdateDeletedProductError when product is DELETED', async () => {
    const product = makeActiveProduct({ status: 'DELETED' });
    mockRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', price: 49.99 })
    ).rejects.toThrow(CannotUpdateDeletedProductError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductPriceError when price is zero', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', price: 0 })
    ).rejects.toThrow(InvalidProductPriceError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductPriceError when price is negative', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', price: -5 })
    ).rejects.toThrow(InvalidProductPriceError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
