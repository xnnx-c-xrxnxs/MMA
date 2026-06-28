import { ActivateProductUseCase } from './activate-product.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';
import { CannotActivateNonInactiveProductError } from '../../../../domain/exceptions';

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

const makeProduct = (overrides = {}) =>
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

describe('ActivateProductUseCase', () => {
  let useCase: ActivateProductUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new ActivateProductUseCase(mockRepo);
  });

  it('should activate an INACTIVE product', async () => {
    const product = makeProduct({ status: 'INACTIVE' });
    mockRepo.findById.mockResolvedValue(product);
    mockRepo.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute('prod-123');

    expect(result.getStatus()).toBe('ACTIVE');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('prod-missing')).rejects.toThrow(
      ProductNotFoundError
    );

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotActivateNonInactiveProductError when already ACTIVE', async () => {
    const product = makeProduct({ status: 'ACTIVE' });
    mockRepo.findById.mockResolvedValue(product);

    await expect(useCase.execute('prod-123')).rejects.toThrow(
      CannotActivateNonInactiveProductError
    );

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
