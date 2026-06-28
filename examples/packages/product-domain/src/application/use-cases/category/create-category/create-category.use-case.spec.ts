import { CreateCategoryUseCase, CreateCategoryInput } from './create-category.use-case';
import { ICategoryRepository } from '../../../interfaces/category/category-repository.interface';
import { ProductCategory } from '../../../../domain/entities';
import {
  InvalidInputError,
  CategoryNameAlreadyExistsError,
} from '../../../exceptions';
import { InvalidCategoryNameError } from '../../../../domain/exceptions';

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

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let mockRepo: jest.Mocked<ICategoryRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockCategoryRepository();
    useCase = new CreateCategoryUseCase(mockRepo);
  });

  it('should create a category successfully', async () => {
    const input: CreateCategoryInput = {
      name: 'Electronics',
      description: 'Electronic devices',
    };
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.save.mockImplementation(async (cat) => cat);

    const result = await useCase.execute(input);

    expect(mockRepo.findByName).toHaveBeenCalledWith('Electronics');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(ProductCategory);
  });

  it('should throw InvalidInputError when name is empty', async () => {
    const input: CreateCategoryInput = { name: '' };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidInputError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CategoryNameAlreadyExistsError when name is taken', async () => {
    const input: CreateCategoryInput = { name: 'Electronics' };
    mockRepo.findByName.mockResolvedValue(makeActiveCategory());

    await expect(useCase.execute(input)).rejects.toThrow(
      CategoryNameAlreadyExistsError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidCategoryNameError when name is whitespace only', async () => {
    const input: CreateCategoryInput = { name: '   ' };
    mockRepo.findByName.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(
      InvalidCategoryNameError
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
