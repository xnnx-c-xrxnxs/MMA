import { SearchProductsByNameUseCase } from './search-products-by-name.use-case';
import { IProductRepository } from '../../../interfaces/product/product-repository.interface';
import { Product } from '../../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';
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

describe('SearchProductsByNameUseCase', () => {
  let useCase: SearchProductsByNameUseCase;
  let mockRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockProductRepository();
    useCase = new SearchProductsByNameUseCase(mockRepo);
  });

  it('should return paginated search results', async () => {
    const paginatedResult: IPaginatedResponse<Product> = {
      data: [makeActiveProduct()],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    mockRepo.searchByName.mockResolvedValue(paginatedResult);

    const result = await useCase.execute({ searchTerm: 'Test' });

    expect(result.data).toHaveLength(1);
    expect(mockRepo.searchByName).toHaveBeenCalledWith(
      'Test',
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('should throw InvalidInputError when searchTerm is empty', async () => {
    await expect(
      useCase.execute({ searchTerm: '' })
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.searchByName).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when searchTerm is only whitespace', async () => {
    await expect(
      useCase.execute({ searchTerm: '   ' })
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.searchByName).not.toHaveBeenCalled();
  });
});
