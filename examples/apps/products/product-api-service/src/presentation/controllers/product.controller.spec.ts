import { ProductController } from './product.controller';
import { ProductApplicationService } from '../../application/services/product-application.service';

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductApplicationService>;

  beforeEach(() => {
    service = {
      createProduct: jest.fn(),
      getProductById: jest.fn(),
      updateProductDetails: jest.fn(),
      updateProductPrice: jest.fn(),
      updateProductInventory: jest.fn(),
      activateProduct: jest.fn(),
      deactivateProduct: jest.fn(),
      discontinueProduct: jest.fn(),
      deleteProduct: jest.fn(),
      listProductsByStatus: jest.fn(),
      listProductsByCategory: jest.fn(),
      searchProductsByName: jest.fn(),
      checkProductsAvailability: jest.fn(),
    } as unknown as jest.Mocked<ProductApplicationService>;

    controller = new ProductController(service);
  });

  it('createProduct delegates to service', () => {
    const body = { name: 'Widget', categoryId: 'cat-1', price: 9.99, inventory: 0, description: '' };
    controller.createProduct(body);
    expect(service.createProduct).toHaveBeenCalledWith(body);
  });

  it('getProductById delegates to service', () => {
    controller.getProductById('prod-1');
    expect(service.getProductById).toHaveBeenCalledWith('prod-1');
  });

  it('updateProductDetails delegates to service', () => {
    const body = { name: 'Updated Widget' };
    controller.updateProductDetails('prod-1', body);
    expect(service.updateProductDetails).toHaveBeenCalledWith('prod-1', body);
  });

  it('updateProductPrice delegates to service', () => {
    controller.updateProductPrice('prod-1', { price: 19.99 });
    expect(service.updateProductPrice).toHaveBeenCalledWith('prod-1', { price: 19.99 });
  });

  it('updateProductInventory delegates to service', () => {
    controller.updateProductInventory('prod-1', { inventory: 50 });
    expect(service.updateProductInventory).toHaveBeenCalledWith('prod-1', { inventory: 50 });
  });

  it('activateProduct delegates to service', () => {
    controller.activateProduct('prod-1');
    expect(service.activateProduct).toHaveBeenCalledWith('prod-1');
  });

  it('deactivateProduct delegates to service', () => {
    controller.deactivateProduct('prod-1');
    expect(service.deactivateProduct).toHaveBeenCalledWith('prod-1');
  });

  it('listProductsByStatus delegates to service', () => {
    const query = { status: 'ACTIVE' as const, limit: 20, direction: 'next' as const };
    controller.listProductsByStatus(query);
    expect(service.listProductsByStatus).toHaveBeenCalledWith(query);
  });

  it('listProductsByCategory delegates to service', () => {
    const query = { categoryId: 'cat-1', limit: 20, direction: 'next' as const };
    controller.listProductsByCategory(query);
    expect(service.listProductsByCategory).toHaveBeenCalledWith(query);
  });

  it('searchProductsByName delegates to service', () => {
    const query = { searchTerm: 'headphone', limit: 20, direction: 'next' as const };
    controller.searchProductsByName(query);
    expect(service.searchProductsByName).toHaveBeenCalledWith(query);
  });

  it('checkProductsAvailability delegates to service', () => {
    const body = { productIds: ['prod-1', 'prod-2'] };
    controller.checkProductsAvailability(body);
    expect(service.checkProductsAvailability).toHaveBeenCalledWith(body);
  });
});
