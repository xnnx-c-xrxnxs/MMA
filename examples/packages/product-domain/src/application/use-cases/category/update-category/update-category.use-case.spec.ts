import {
  UpdateCategoryUseCase,
  UpdateCategoryInput,
} from './update-category.use-case';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import { CategoryNotFoundError } from '../../../exceptions';
import { CannotUpdateDeletedCategoryError } from '../../../../domain/exceptions';

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

describe('UpdateCategoryUseCase', () => {
  let useCase: UpdateCategoryUseCase;
  let mockRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockCategoryRepository();
    useCase = new UpdateCategoryUseCase(mockRepo);
  });

  it('should update a category successfully', async () => {
    const category = makeActiveCategory();
    mockRepo.findById.mockResolvedValue(category);
    mockRepo.save.mockImplementation(async (cat) => cat);

    const input: UpdateCategoryInput = {
      categoryId: 'cat-123',
      name: 'Updated Electronics',
      description: 'Updated description',
    };

    const result = await useCase.execute(input);

    expect(mockRepo.findById).toHaveBeenCalledWith('cat-123');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(ProductCategory);
  });

  it('should throw CategoryNotFoundError when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const input: UpdateCategoryInput = {
      categoryId: 'cat-999',
      name: 'Updated',
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      CategoryNotFoundError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotUpdateDeletedCategoryError when category is DELETED', async () => {
    const deletedCategory = makeActiveCategory({ status: 'DELETED' });
    mockRepo.findById.mockResolvedValue(deletedCategory);

    const input: UpdateCategoryInput = {
      categoryId: 'cat-123',
      name: 'Attempt Update',
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      CannotUpdateDeletedCategoryError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
