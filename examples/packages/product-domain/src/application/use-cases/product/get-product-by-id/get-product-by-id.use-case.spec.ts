import { GetProductByIdUseCase } from './get-product-by-id.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { ProductNotFoundError } from '../../../exceptions';

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

describe('GetProductByIdUseCase', () => {
  let useCase: GetProductByIdUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new GetProductByIdUseCase(mockRepo);
  });

  it('should return the product when found', async () => {
    const product = makeActiveProduct();
    mockRepo.findById.mockResolvedValue(product);

    const result = await useCase.execute('prod-123');

    expect(result).toBe(product);
    expect(mockRepo.findById).toHaveBeenCalledWith('prod-123');
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('prod-missing')).rejects.toThrow(
      ProductNotFoundError
    );
  });
});
