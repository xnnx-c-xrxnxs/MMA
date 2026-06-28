import { CategoryController } from './category.controller';
import { CategoryApplicationService } from '../../application/services/category-application.service';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<CategoryApplicationService>;

  beforeEach(() => {
    service = {
      createCategory: jest.fn(),
      getCategoryById: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      listCategories: jest.fn(),
      activateCategory: jest.fn(),
      deactivateCategory: jest.fn(),
      discontinueCategory: jest.fn(),
    } as unknown as jest.Mocked<CategoryApplicationService>;

    controller = new CategoryController(service);
  });

  it('createCategory delegates to service', () => {
    const body = { name: 'Electronics', description: 'Electronic goods' };
    controller.createCategory(body);
    expect(service.createCategory).toHaveBeenCalledWith(body);
  });

  it('getCategoryById delegates to service', () => {
    controller.getCategoryById('cat-1');
    expect(service.getCategoryById).toHaveBeenCalledWith('cat-1');
  });

  it('updateCategory delegates to service', () => {
    const body = { name: 'Updated Electronics' };
    controller.updateCategory('cat-1', body);
    expect(service.updateCategory).toHaveBeenCalledWith('cat-1', body);
  });

  it('deleteCategory delegates to service', async () => {
    service.deleteCategory.mockResolvedValue(undefined);
    await controller.deleteCategory('cat-1');
    expect(service.deleteCategory).toHaveBeenCalledWith('cat-1');
  });

  it('listCategories delegates to service', () => {
    const query = { limit: 20, direction: 'next' as const };
    controller.listCategories(query);
    expect(service.listCategories).toHaveBeenCalledWith(query);
  });
});
