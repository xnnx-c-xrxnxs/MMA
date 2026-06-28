import { CheckProductsAvailabilityUseCase } from './check-products-availability.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { InvalidInputError } from '../../../exceptions';

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

describe('CheckProductsAvailabilityUseCase', () => {
  let useCase: CheckProductsAvailabilityUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new CheckProductsAvailabilityUseCase(mockRepo);
  });

  it('should return available products', async () => {
    const products = [
      makeActiveProduct({ productId: 'prod-1' }),
      makeActiveProduct({ productId: 'prod-2' }),
    ];
    mockRepo.checkAvailability.mockResolvedValue(products);

    const result = await useCase.execute({ productIds: ['prod-1', 'prod-2'] });

    expect(result).toHaveLength(2);
    expect(mockRepo.checkAvailability).toHaveBeenCalledWith(['prod-1', 'prod-2']);
  });

  it('should throw InvalidInputError when productIds is empty', async () => {
    await expect(
      useCase.execute({ productIds: [] })
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.checkAvailability).not.toHaveBeenCalled();
  });
});
