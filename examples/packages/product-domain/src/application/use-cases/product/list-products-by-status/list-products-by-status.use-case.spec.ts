import { ListProductsByStatusUseCase } from './list-products-by-status.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';
import { InvalidInputError } from '../../../exceptions';
import { PRODUCT_STATUSES } from '../../../../domain/constants';

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

describe('ListProductsByStatusUseCase', () => {
  let useCase: ListProductsByStatusUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new ListProductsByStatusUseCase(mockRepo);
  });

  it('should return paginated products by status', async () => {
    const paginatedResult: IPaginatedResponse<Product> = {
      data: [makeActiveProduct()],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    mockRepo.listByStatus.mockResolvedValue(paginatedResult);

    const result = await useCase.execute({ status: 'ACTIVE' });

    expect(result.data).toHaveLength(1);
    expect(mockRepo.listByStatus).toHaveBeenCalledWith(
      'ACTIVE',
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('should throw InvalidInputError when status is empty', async () => {
    await expect(
      useCase.execute({ status: '' as any })
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.listByStatus).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when status is invalid', async () => {
    await expect(
      useCase.execute({ status: 'INVALID_STATUS' as any })
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.listByStatus).not.toHaveBeenCalled();
  });
});
