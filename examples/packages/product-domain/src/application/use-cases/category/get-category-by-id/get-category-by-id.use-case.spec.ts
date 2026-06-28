import { GetCategoryByIdUseCase } from './get-category-by-id.use-case';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';

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

describe('GetCategoryByIdUseCase', () => {
  let useCase: GetCategoryByIdUseCase;
  let mockRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockCategoryRepository();
    useCase = new GetCategoryByIdUseCase(mockRepo);
  });

  it('should return a category when found', async () => {
    const category = makeActiveCategory();
    mockRepo.findById.mockResolvedValue(category);

    const result = await useCase.execute('cat-123');

    expect(mockRepo.findById).toHaveBeenCalledWith('cat-123');
    expect(result).toBe(category);
  });

  it('should throw CategoryNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('cat-999')).rejects.toThrow(
      CategoryNotFoundError
    );
  });
});
