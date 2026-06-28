import { buildDomainNames, validateDomainName } from './naming';

describe('naming helpers', () => {
  describe('buildDomainNames', () => {
    it('produces all forms for a single-word name', () => {
      const n = buildDomainNames('shipping');
      expect(n).toEqual({
        kebab: 'shipping',
        kebabPlural: 'shippings',
        pascal: 'Shipping',
        pascalPlural: 'Shippings',
        camel: 'shipping',
        camelPlural: 'shippings',
        constant: 'SHIPPING',
        constantPlural: 'SHIPPINGS',
      });
    });

    it('produces all forms for a kebab-case multi-word name', () => {
      const n = buildDomainNames('order-item');
      expect(n.kebab).toBe('order-item');
      expect(n.pascal).toBe('OrderItem');
      expect(n.camel).toBe('orderItem');
      expect(n.constant).toBe('ORDER_ITEM');
      expect(n.kebabPlural).toBe('order-items');
      expect(n.pascalPlural).toBe('OrderItems');
    });

    it('handles English y → ies', () => {
      const n = buildDomainNames('category');
      expect(n.kebabPlural).toBe('categories');
      expect(n.pascalPlural).toBe('Categories');
    });

    it('handles s/x/z/ch/sh → +es', () => {
      expect(buildDomainNames('address').kebabPlural).toBe('addresses');
      expect(buildDomainNames('box').kebabPlural).toBe('boxes');
      expect(buildDomainNames('quiz').kebabPlural).toBe('quizes');
      expect(buildDomainNames('branch').kebabPlural).toBe('branches');
      expect(buildDomainNames('dish').kebabPlural).toBe('dishes');
    });

    it('accepts a custom plural override', () => {
      const n = buildDomainNames('person', 'people');
      expect(n.kebabPlural).toBe('people');
      expect(n.pascalPlural).toBe('People');
    });

    it('throws on empty input', () => {
      expect(() => buildDomainNames('')).toThrow();
    });
  });

  describe('validateDomainName', () => {
    it('accepts lowercase kebab-case names', () => {
      expect(() => validateDomainName('shipping')).not.toThrow();
      expect(() => validateDomainName('order-item')).not.toThrow();
    });

    it('rejects empty / whitespace', () => {
      expect(() => validateDomainName('')).toThrow();
      expect(() => validateDomainName('  ')).toThrow();
    });

    it('rejects PascalCase / camelCase', () => {
      expect(() => validateDomainName('Shipping')).toThrow();
      expect(() => validateDomainName('orderItem')).toThrow();
    });

    it('rejects names with underscores or special chars', () => {
      expect(() => validateDomainName('order_item')).toThrow();
      expect(() => validateDomainName('order.item')).toThrow();
    });

    it('rejects names starting with a digit', () => {
      expect(() => validateDomainName('1shipping')).toThrow();
    });
  });
});
