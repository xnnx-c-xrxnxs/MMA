import { DeleteCategoryUseCase } from './delete-category.use-case';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';
import { CategoryAlreadyDeletedError } from '../../../../domain/exceptions';

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

describe('DeleteCategoryUseCase', () => {
  let useCase: DeleteCategoryUseCase;
  let mockRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockCategoryRepository();
    useCase = new DeleteCategoryUseCase(mockRepo);
  });

  it('should soft delete a category successfully', async () => {
    const category = makeActiveCategory();
    mockRepo.findById.mockResolvedValue(category);
    mockRepo.save.mockImplementation(async (cat) => cat);

    await useCase.execute('cat-123');

    expect(mockRepo.findById).toHaveBeenCalledWith('cat-123');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);

    const savedCategory = mockRepo.save.mock.calls[0][0];
    expect(savedCategory.isDeleted()).toBe(true);
  });

  it('should throw CategoryNotFoundError when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('cat-999')).rejects.toThrow(
      CategoryNotFoundError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CategoryAlreadyDeletedError when category is already DELETED', async () => {
    const deletedCategory = makeActiveCategory({ status: 'DELETED' });
    mockRepo.findById.mockResolvedValue(deletedCategory);

    await expect(useCase.execute('cat-123')).rejects.toThrow(
      CategoryAlreadyDeletedError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
