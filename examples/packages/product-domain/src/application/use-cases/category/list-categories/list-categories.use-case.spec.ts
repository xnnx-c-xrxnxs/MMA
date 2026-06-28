import {
  ListCategoriesUseCase,
  ListCategoriesInput,
} from './list-categories.use-case';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { IPaginatedResponse } from '@old-st/common';

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

describe('ListCategoriesUseCase', () => {
  let useCase: ListCategoriesUseCase;
  let mockRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockCategoryRepository();
    useCase = new ListCategoriesUseCase(mockRepo);
  });

  it('should return a paginated list of categories', async () => {
    const paginatedResponse: IPaginatedResponse<ProductCategory> = {
      data: [makeActiveCategory(), makeActiveCategory({ categoryId: 'cat-456', name: 'Books' })],
      nextCursorPointer: { pk: 'cat-456', sk: 'CATEGORY' },
      prevCursorPointer: null,
    };
    mockRepo.listAll.mockResolvedValue(paginatedResponse);

    const input: ListCategoriesInput = { limit: 10 };
    const result = await useCase.execute(input);

    expect(result).toBe(paginatedResponse);
    expect(result.data).toHaveLength(2);
  });

  it('should pass pagination params correctly to the repository', async () => {
    const paginatedResponse: IPaginatedResponse<ProductCategory> = {
      data: [],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    mockRepo.listAll.mockResolvedValue(paginatedResponse);

    const input: ListCategoriesInput = {
      limit: 5,
      direction: 'next',
      nextCursorPointer: 'cursor-abc',
      prevCursorPointer: undefined,
    };
    await useCase.execute(input);

    expect(mockRepo.listAll).toHaveBeenCalledWith(
      5,
      'next',
      'cursor-abc',
      undefined
    );
  });
});
