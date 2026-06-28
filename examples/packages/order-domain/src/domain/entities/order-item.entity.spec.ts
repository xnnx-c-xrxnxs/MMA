import { OrderItem } from './order-item.entity';
import {
  InvalidQuantityError,
  InvalidPriceError,
  ProductNameRequiredError,
} from '../exceptions';

describe('OrderItem Entity', () => {
  describe('create()', () => {
    it('should create a valid order item', () => {
      const item = OrderItem.create({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 3,
        price: 9.99,
      });

      expect(item.getProductId()).toBe('prod-1');
      expect(item.getProductName()).toBe('Widget');
      expect(item.getQuantity()).toBe(3);
      expect(item.getPrice()).toBe(9.99);
      expect(item.getItemId()).toBeNull();
      expect(item.getDateCreated()).toBeDefined();
    });

    it('should trim whitespace from product name', () => {
      const item = OrderItem.create({
        productId: 'prod-1',
        productName: '  Widget  ',
        quantity: 1,
        price: 5,
      });

      expect(item.getProductName()).toBe('Widget');
    });

    it('should throw InvalidQuantityError for zero quantity', () => {
      expect(() =>
        OrderItem.create({ productId: 'p1', productName: 'X', quantity: 0, price: 5 }),
      ).toThrow(InvalidQuantityError);
    });

    it('should throw InvalidQuantityError for negative quantity', () => {
      expect(() =>
        OrderItem.create({ productId: 'p1', productName: 'X', quantity: -1, price: 5 }),
      ).toThrow(InvalidQuantityError);
    });

    it('should throw InvalidPriceError for negative price', () => {
      expect(() =>
        OrderItem.create({ productId: 'p1', productName: 'X', quantity: 1, price: -1 }),
      ).toThrow(InvalidPriceError);
    });

    it('should allow zero price', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Free Item',
        quantity: 1,
        price: 0,
      });

      expect(item.getPrice()).toBe(0);
    });

    it('should throw ProductNameRequiredError for empty product name', () => {
      expect(() =>
        OrderItem.create({ productId: 'p1', productName: '', quantity: 1, price: 5 }),
      ).toThrow(ProductNameRequiredError);
    });

    it('should throw ProductNameRequiredError for whitespace-only product name', () => {
      expect(() =>
        OrderItem.create({ productId: 'p1', productName: '   ', quantity: 1, price: 5 }),
      ).toThrow(ProductNameRequiredError);
    });
  });

  describe('reconstitute()', () => {
    it('should restore entity without applying create() validators', () => {
      const item = OrderItem.reconstitute({
        itemId: 'item-123',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 5,
        price: 10.5,
        latestKnownPrice: null,
        dateCreated: '2024-01-01T00:00:00.000Z',
      });

      expect(item.getItemId()).toBe('item-123');
      expect(item.getProductId()).toBe('prod-1');
      expect(item.getProductName()).toBe('Widget');
      expect(item.getQuantity()).toBe(5);
      expect(item.getPrice()).toBe(10.5);
      expect(item.getDateCreated()).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('updateQuantity()', () => {
    it('should update quantity to a valid value', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

      item.updateQuantity(5);

      expect(item.getQuantity()).toBe(5);
    });

    it('should throw InvalidQuantityError for zero', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

      expect(() => item.updateQuantity(0)).toThrow(InvalidQuantityError);
    });

    it('should throw InvalidQuantityError for negative value', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

      expect(() => item.updateQuantity(-3)).toThrow(InvalidQuantityError);
    });
  });

  describe('getSubtotal()', () => {
    it('should calculate subtotal correctly', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Widget',
        quantity: 3,
        price: 9.99,
      });

      expect(item.getSubtotal()).toBeCloseTo(29.97, 2);
    });

    it('should return 0 for free items', () => {
      const item = OrderItem.create({
        productId: 'p1',
        productName: 'Free Widget',
        quantity: 5,
        price: 0,
      });

      expect(item.getSubtotal()).toBe(0);
    });
  });
});
