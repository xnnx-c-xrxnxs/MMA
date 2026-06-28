import {
  userStatusVariant,
  orderStatusVariant,
  paymentStatusVariant,
  productStatusVariant,
  categoryStatusVariant,
} from './status-variants';

describe('status-variants', () => {
  describe('userStatusVariant', () => {
    it.each([
      ['ACTIVE', 'success'],
      ['PENDING', 'warning'],
      ['INACTIVE', 'secondary'],
      ['DELETED', 'destructive'],
      ['UNKNOWN', 'outline'],
    ])('%s → %s', (status, expected) => {
      expect(userStatusVariant(status)).toBe(expected);
    });
  });

  describe('orderStatusVariant', () => {
    it.each([
      ['DRAFT', 'secondary'],
      ['PENDING', 'warning'],
      ['CONFIRMED', 'default'],
      ['PROCESSING', 'default'],
      ['SHIPPED', 'default'],
      ['DELIVERED', 'success'],
      ['CANCELLED', 'destructive'],
      ['REFUNDED', 'destructive'],
      ['VALIDATION_FAILED', 'destructive'],
      ['UNKNOWN', 'outline'],
    ])('%s → %s', (status, expected) => {
      expect(orderStatusVariant(status)).toBe(expected);
    });
  });

  describe('paymentStatusVariant', () => {
    it.each([
      ['CAPTURED', 'success'],
      ['AUTHORIZED', 'default'],
      ['PENDING', 'warning'],
      ['FAILED', 'destructive'],
      ['CANCELLED', 'destructive'],
      ['REFUNDED', 'destructive'],
      ['UNKNOWN', 'outline'],
    ])('%s → %s', (status, expected) => {
      expect(paymentStatusVariant(status)).toBe(expected);
    });
  });

  describe('productStatusVariant', () => {
    it.each([
      ['ACTIVE', 'success'],
      ['INACTIVE', 'secondary'],
      ['DISCONTINUED', 'warning'],
      ['DELETED', 'destructive'],
      ['UNKNOWN', 'outline'],
    ])('%s → %s', (status, expected) => {
      expect(productStatusVariant(status)).toBe(expected);
    });
  });

  describe('categoryStatusVariant', () => {
    it.each([
      ['ACTIVE', 'success'],
      ['INACTIVE', 'secondary'],
      ['DISCONTINUED', 'warning'],
      ['DELETED', 'destructive'],
      ['UNKNOWN', 'outline'],
    ])('%s → %s', (status, expected) => {
      expect(categoryStatusVariant(status)).toBe(expected);
    });
  });
});
