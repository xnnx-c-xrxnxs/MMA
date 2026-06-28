import { Product } from './product.entity';
import { ProductStatusEnum } from '../../constants';
import {
  CannotActivateNonInactiveProductError,
  CannotDeactivateNonActiveProductError,
  CannotDiscontinueProductError,
  ProductAlreadyDeletedError,
  CannotUpdateDeletedProductError,
  CannotUpdateDiscontinuedProductError,
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductInventoryError,
} from '../../exceptions';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_PROPS = {
  productId: 'prod-123',
  name: 'Widget',
  description: 'A fine widget',
  categoryId: 'cat-1',
  price: 29.99,
  inventory: 10,
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function makeActiveProduct() {
  return Product.reconstitute({ ...BASE_PROPS, status: ProductStatusEnum.ACTIVE });
}

function makeInactiveProduct() {
  return Product.reconstitute({ ...BASE_PROPS, status: ProductStatusEnum.INACTIVE });
}

function makeDiscontinuedProduct() {
  return Product.reconstitute({ ...BASE_PROPS, status: ProductStatusEnum.DISCONTINUED });
}

function makeDeletedProduct() {
  return Product.reconstitute({ ...BASE_PROPS, status: ProductStatusEnum.DELETED });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Product', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a product with defaults (inventory=0, status=ACTIVE, productId=null, trimmed fields)', () => {
      const product = Product.create({
        name: '  Widget  ',
        description: '  A fine widget  ',
        categoryId: 'cat-1',
        price: 19.99,
      });

      expect(product.getProductId()).toBeNull();
      expect(product.getName()).toBe('Widget');
      expect(product.getDescription()).toBe('A fine widget');
      expect(product.getCategoryId()).toBe('cat-1');
      expect(product.getPrice()).toBe(19.99);
      expect(product.getInventory()).toBe(0);
      expect(product.getStatus()).toBe(ProductStatusEnum.ACTIVE);
      expect(product.getDateCreated()).toBeDefined();
      expect(product.getUpdatedAt()).toBeDefined();
    });

    it('should create a product with custom inventory', () => {
      const product = Product.create({
        name: 'Gadget',
        categoryId: 'cat-2',
        price: 50,
        inventory: 100,
      });

      expect(product.getInventory()).toBe(100);
    });

    it('should throw InvalidProductNameError when name is empty', () => {
      expect(() =>
        Product.create({ name: '   ', categoryId: 'cat-1', price: 10 }),
      ).toThrow(InvalidProductNameError);
    });

    it('should throw InvalidProductPriceError when price is zero', () => {
      expect(() =>
        Product.create({ name: 'X', categoryId: 'cat-1', price: 0 }),
      ).toThrow(InvalidProductPriceError);
    });

    it('should throw InvalidProductPriceError when price is negative', () => {
      expect(() =>
        Product.create({ name: 'X', categoryId: 'cat-1', price: -5 }),
      ).toThrow(InvalidProductPriceError);
    });

    it('should throw InvalidProductInventoryError when inventory is negative', () => {
      expect(() =>
        Product.create({ name: 'X', categoryId: 'cat-1', price: 10, inventory: -1 }),
      ).toThrow(InvalidProductInventoryError);
    });
  });

  // ── reconstitute() ──────────────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('should restore all fields without validation', () => {
      const product = Product.reconstitute({
        productId: 'prod-999',
        name: 'Restored',
        description: undefined,
        categoryId: 'cat-5',
        price: 100,
        inventory: 50,
        status: ProductStatusEnum.DISCONTINUED,
        dateCreated: '2024-06-01T00:00:00.000Z',
        updatedAt: '2024-12-01T00:00:00.000Z',
      });

      expect(product.getProductId()).toBe('prod-999');
      expect(product.getName()).toBe('Restored');
      expect(product.getDescription()).toBeUndefined();
      expect(product.getCategoryId()).toBe('cat-5');
      expect(product.getPrice()).toBe(100);
      expect(product.getInventory()).toBe(50);
      expect(product.getStatus()).toBe(ProductStatusEnum.DISCONTINUED);
      expect(product.getDateCreated()).toBe('2024-06-01T00:00:00.000Z');
      expect(product.getUpdatedAt()).toBe('2024-12-01T00:00:00.000Z');
    });
  });

  // ── activate() ──────────────────────────────────────────────────────────────

  describe('activate()', () => {
    it('should activate an INACTIVE product', () => {
      const product = makeInactiveProduct();
      product.activate();
      expect(product.getStatus()).toBe(ProductStatusEnum.ACTIVE);
    });

    it('should throw CannotActivateNonInactiveProductError when ACTIVE', () => {
      expect(() => makeActiveProduct().activate()).toThrow(CannotActivateNonInactiveProductError);
    });

    it('should throw CannotActivateNonInactiveProductError when DELETED', () => {
      expect(() => makeDeletedProduct().activate()).toThrow(CannotActivateNonInactiveProductError);
    });

    it('should throw CannotActivateNonInactiveProductError when DISCONTINUED', () => {
      expect(() => makeDiscontinuedProduct().activate()).toThrow(CannotActivateNonInactiveProductError);
    });
  });

  // ── deactivate() ────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should deactivate an ACTIVE product', () => {
      const product = makeActiveProduct();
      product.deactivate();
      expect(product.getStatus()).toBe(ProductStatusEnum.INACTIVE);
    });

    it('should throw CannotDeactivateNonActiveProductError when INACTIVE', () => {
      expect(() => makeInactiveProduct().deactivate()).toThrow(CannotDeactivateNonActiveProductError);
    });

    it('should throw CannotDeactivateNonActiveProductError when DELETED', () => {
      expect(() => makeDeletedProduct().deactivate()).toThrow(CannotDeactivateNonActiveProductError);
    });
  });

  // ── discontinue() ──────────────────────────────────────────────────────────

  describe('discontinue()', () => {
    it('should discontinue an ACTIVE product', () => {
      const product = makeActiveProduct();
      product.discontinue();
      expect(product.getStatus()).toBe(ProductStatusEnum.DISCONTINUED);
    });

    it('should discontinue an INACTIVE product', () => {
      const product = makeInactiveProduct();
      product.discontinue();
      expect(product.getStatus()).toBe(ProductStatusEnum.DISCONTINUED);
    });

    it('should throw CannotDiscontinueProductError when DELETED', () => {
      expect(() => makeDeletedProduct().discontinue()).toThrow(CannotDiscontinueProductError);
    });

    it('should throw CannotDiscontinueProductError when already DISCONTINUED', () => {
      expect(() => makeDiscontinuedProduct().discontinue()).toThrow(CannotDiscontinueProductError);
    });
  });

  // ── markAsDeleted() ────────────────────────────────────────────────────────

  describe('markAsDeleted()', () => {
    it('should mark an ACTIVE product as DELETED', () => {
      const product = makeActiveProduct();
      product.markAsDeleted();
      expect(product.getStatus()).toBe(ProductStatusEnum.DELETED);
    });

    it('should mark an INACTIVE product as DELETED', () => {
      const product = makeInactiveProduct();
      product.markAsDeleted();
      expect(product.getStatus()).toBe(ProductStatusEnum.DELETED);
    });

    it('should mark a DISCONTINUED product as DELETED', () => {
      const product = makeDiscontinuedProduct();
      product.markAsDeleted();
      expect(product.getStatus()).toBe(ProductStatusEnum.DELETED);
    });

    it('should throw ProductAlreadyDeletedError when already DELETED', () => {
      expect(() => makeDeletedProduct().markAsDeleted()).toThrow(ProductAlreadyDeletedError);
    });
  });

  // ── updateDetails() ────────────────────────────────────────────────────────

  describe('updateDetails()', () => {
    it('should update name, description, and categoryId on an ACTIVE product', () => {
      const product = makeActiveProduct();
      product.updateDetails('  New Name  ', '  New Desc  ', 'cat-99');

      expect(product.getName()).toBe('New Name');
      expect(product.getDescription()).toBe('New Desc');
      expect(product.getCategoryId()).toBe('cat-99');
    });

    it('should allow updates on an INACTIVE product', () => {
      const product = makeInactiveProduct();
      product.updateDetails('Updated', 'Updated desc');

      expect(product.getName()).toBe('Updated');
      expect(product.getDescription()).toBe('Updated desc');
    });

    it('should throw CannotUpdateDeletedProductError when DELETED', () => {
      expect(() => makeDeletedProduct().updateDetails('X')).toThrow(CannotUpdateDeletedProductError);
    });

    it('should throw CannotUpdateDiscontinuedProductError when DISCONTINUED', () => {
      expect(() => makeDiscontinuedProduct().updateDetails('X')).toThrow(
        CannotUpdateDiscontinuedProductError,
      );
    });

    it('should throw InvalidProductNameError when name is empty string', () => {
      const product = makeActiveProduct();
      expect(() => product.updateDetails('   ')).toThrow(InvalidProductNameError);
    });
  });

  // ── updatePrice() ──────────────────────────────────────────────────────────

  describe('updatePrice()', () => {
    it('should update price on an ACTIVE product', () => {
      const product = makeActiveProduct();
      product.updatePrice(49.99);
      expect(product.getPrice()).toBe(49.99);
    });

    it('should throw CannotUpdateDeletedProductError when DELETED', () => {
      expect(() => makeDeletedProduct().updatePrice(10)).toThrow(CannotUpdateDeletedProductError);
    });

    it('should throw CannotUpdateDiscontinuedProductError when DISCONTINUED', () => {
      expect(() => makeDiscontinuedProduct().updatePrice(10)).toThrow(
        CannotUpdateDiscontinuedProductError,
      );
    });

    it('should throw InvalidProductPriceError when price is zero', () => {
      const product = makeActiveProduct();
      expect(() => product.updatePrice(0)).toThrow(InvalidProductPriceError);
    });
  });

  // ── updateInventory() ──────────────────────────────────────────────────────

  describe('updateInventory()', () => {
    it('should update inventory on an ACTIVE product', () => {
      const product = makeActiveProduct();
      product.updateInventory(200);
      expect(product.getInventory()).toBe(200);
    });

    it('should throw CannotUpdateDeletedProductError when DELETED', () => {
      expect(() => makeDeletedProduct().updateInventory(5)).toThrow(
        CannotUpdateDeletedProductError,
      );
    });

    it('should throw CannotUpdateDiscontinuedProductError when DISCONTINUED', () => {
      expect(() => makeDiscontinuedProduct().updateInventory(5)).toThrow(
        CannotUpdateDiscontinuedProductError,
      );
    });

    it('should throw InvalidProductInventoryError when inventory is negative', () => {
      const product = makeActiveProduct();
      expect(() => product.updateInventory(-1)).toThrow(InvalidProductInventoryError);
    });
  });

  // ── Status helpers ─────────────────────────────────────────────────────────

  describe('status helpers', () => {
    it('isActive() returns true for ACTIVE', () => {
      expect(makeActiveProduct().isActive()).toBe(true);
      expect(makeInactiveProduct().isActive()).toBe(false);
    });

    it('isInactive() returns true for INACTIVE', () => {
      expect(makeInactiveProduct().isInactive()).toBe(true);
      expect(makeActiveProduct().isInactive()).toBe(false);
    });

    it('isDiscontinued() returns true for DISCONTINUED', () => {
      expect(makeDiscontinuedProduct().isDiscontinued()).toBe(true);
      expect(makeActiveProduct().isDiscontinued()).toBe(false);
    });

    it('isDeleted() returns true for DELETED', () => {
      expect(makeDeletedProduct().isDeleted()).toBe(true);
      expect(makeActiveProduct().isDeleted()).toBe(false);
    });
  });

});
