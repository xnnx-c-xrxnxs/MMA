import { CategoryApplicationService } from './category-application.service';
import { ProductCategory } from '@old-st/product-domain';

jest.mock('@old-st/contracts/product', () => ({
  ...jest.requireActual('@old-st/contracts/product'),
  categoryResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

function createMockCategory(overrides: Partial<Record<string, unknown>> = {}): ProductCategory {
  return ProductCategory.reconstitute({
    categoryId: 'cat-1',
    name: 'Electronics',
    description: 'Electronic items',
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function createMockUseCases() {
  return {
    createCategoryUseCase: { execute: jest.fn() },
    getCategoryByIdUseCase: { execute: jest.fn() },
    listCategoriesUseCase: { execute: jest.fn() },
    updateCategoryUseCase: { execute: jest.fn() },
    deleteCategoryUseCase: { execute: jest.fn() },
  };
}

describe('CategoryApplicationService', () => {
  let service: CategoryApplicationService;
  let mocks: ReturnType<typeof createMockUseCases>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockUseCases();
    service = new CategoryApplicationService(
      mocks.createCategoryUseCase as any,
      mocks.getCategoryByIdUseCase as any,
      mocks.listCategoriesUseCase as any,
      mocks.updateCategoryUseCase as any,
      mocks.deleteCategoryUseCase as any,
    );
  });

  describe('createCategory', () => {
    it('should delegate to use case and return DTO', async () => {
      const category = createMockCategory();
      mocks.createCategoryUseCase.execute.mockResolvedValue(category);

      const result = await service.createCategory({
        name: 'Electronics',
        description: 'Electronic items',
      });

      expect(mocks.createCategoryUseCase.execute).toHaveBeenCalledWith({
        name: 'Electronics',
        description: 'Electronic items',
      });
      expect(result.categoryId).toBe('cat-1');
    });
  });

  describe('getCategoryById', () => {
    it('should delegate to use case and return DTO', async () => {
      const category = createMockCategory();
      mocks.getCategoryByIdUseCase.execute.mockResolvedValue(category);

      const result = await service.getCategoryById('cat-1');

      expect(result.categoryId).toBe('cat-1');
      expect(result.name).toBe('Electronics');
    });
  });

  describe('listCategories', () => {
    it('should route cursor correctly for next direction', async () => {
      mocks.listCategoriesUseCase.execute.mockResolvedValue({
        data: [createMockCategory()],
        nextCursorPointer: 'next-cursor',
        prevCursorPointer: undefined,
      });

      const result = await service.listCategories({
        direction: 'next',
        cursor: 'my-cursor',
        limit: 10,
      });

      expect(mocks.listCategoriesUseCase.execute).toHaveBeenCalledWith({
        limit: 10,
        direction: 'next',
        nextCursorPointer: 'my-cursor',
        prevCursorPointer: undefined,
      });
      expect(result.data).toHaveLength(1);
    });

    it('should route cursor to prevCursorPointer when direction is prev', async () => {
      mocks.listCategoriesUseCase.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: undefined,
        prevCursorPointer: undefined,
      });

      await service.listCategories({
        limit: 20,
        direction: 'prev',
        cursor: 'prev-cursor',
      });

      expect(mocks.listCategoriesUseCase.execute).toHaveBeenCalledWith({
        limit: 20,
        direction: 'prev',
        nextCursorPointer: undefined,
        prevCursorPointer: 'prev-cursor',
      });
    });
  });

  describe('updateCategory', () => {
    it('should delegate to use case with categoryId merged', async () => {
      const category = createMockCategory({ name: 'Updated' });
      mocks.updateCategoryUseCase.execute.mockResolvedValue(category);

      const result = await service.updateCategory('cat-1', {
        name: 'Updated',
        description: 'Updated desc',
      });

      expect(mocks.updateCategoryUseCase.execute).toHaveBeenCalledWith({
        categoryId: 'cat-1',
        name: 'Updated',
        description: 'Updated desc',
      });
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteCategory', () => {
    it('should delegate to use case', async () => {
      mocks.deleteCategoryUseCase.execute.mockResolvedValue(undefined);

      await service.deleteCategory('cat-1');

      expect(mocks.deleteCategoryUseCase.execute).toHaveBeenCalledWith('cat-1');
    });
  });

  describe('error propagation', () => {
    it('should propagate use case errors', async () => {
      mocks.getCategoryByIdUseCase.execute.mockRejectedValue(new Error('Not found'));

      await expect(service.getCategoryById('nonexistent')).rejects.toThrow('Not found');
    });
  });
});
