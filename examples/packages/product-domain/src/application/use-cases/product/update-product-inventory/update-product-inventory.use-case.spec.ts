import { UpdateProductInventoryUseCase } from './update-product-inventory.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';
import {
  CannotUpdateDeletedProductError,
  InvalidProductInventoryError,
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

describe('UpdateProductInventoryUseCase', () => {
  let useCase: UpdateProductInventoryUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new UpdateProductInventoryUseCase(mockRepo);
  });

  it('should update the product inventory and persist', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);
    mockRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({ productId: 'prod-123', inventory: 200 });

    expect(result.getInventory()).toBe(200);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: 'prod-missing', inventory: 50 })
    ).rejects.toThrow(ProductNotFoundError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotUpdateDeletedProductError when product is DELETED', async () => {
    const product = makeActiveProduct({ status: 'DELETED' });
    mockRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', inventory: 50 })
    ).rejects.toThrow(CannotUpdateDeletedProductError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidProductInventoryError when inventory is negative', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);

    await expect(
      useCase.execute({ productId: 'prod-123', inventory: -1 })
    ).rejects.toThrow(InvalidProductInventoryError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
