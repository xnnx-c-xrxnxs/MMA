import { Customer } from './customer.entity';
import { CustomerStatusEnum, CustomerTierEnum } from '../constants';
import {
  CustomerAlreadyInactiveError,
  InvalidCustomerNameError,
  InvalidCustomerTierError,
} from '../exceptions';

describe('Customer', () => {
  describe('create()', () => {
    it('creates an ACTIVE customer with FREE tier default and null id', () => {
      const customer = Customer.create({
        name: 'Acme Contact',
        email: 'jane@acme.com',
      });
      expect(customer.getCustomerId()).toBeNull();
      expect(customer.getCustomerStatus()).toBe(CustomerStatusEnum.ACTIVE);
      expect(customer.getTier()).toBe(CustomerTierEnum.FREE);
      expect(customer.getDateCreated()).toBe(customer.getUpdatedAt());
    });

    it('honours a provided tier', () => {
      const customer = Customer.create({
        name: 'Acme Contact',
        email: 'jane@acme.com',
        tier: 'ENTERPRISE',
      });
      expect(customer.getTier()).toBe(CustomerTierEnum.ENTERPRISE);
    });

    it('throws on invalid tier', () => {
      expect(() =>
        Customer.create({ name: 'A', email: 'a@b.com', tier: 'PLATINUM' }),
      ).toThrow(InvalidCustomerTierError);
    });

    it('throws on empty name', () => {
      expect(() =>
        Customer.create({ name: '   ', email: 'a@b.com' }),
      ).toThrow(InvalidCustomerNameError);
    });

    it('throws on name longer than 120 chars', () => {
      expect(() =>
        Customer.create({ name: 'x'.repeat(121), email: 'a@b.com' }),
      ).toThrow(InvalidCustomerNameError);
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields without running create() validators', () => {
      const customer = Customer.reconstitute({
        customerId: 'cust-1',
        name: 'Old Name',
        email: 'old@acme.com',
        userId: 'user-1',
        company: 'Acme',
        tier: CustomerTierEnum.PRO,
        customerStatus: CustomerStatusEnum.INACTIVE,
        dateCreated: '2020-01-01T00:00:00.000Z',
        updatedAt: '2021-01-01T00:00:00.000Z',
      });
      expect(customer.getCustomerId()).toBe('cust-1');
      expect(customer.getCustomerStatus()).toBe(CustomerStatusEnum.INACTIVE);
      expect(customer.getTier()).toBe(CustomerTierEnum.PRO);
    });
  });

  describe('email immutability', () => {
    it('has no setter and updateProfile cannot change email', () => {
      const customer = Customer.create({
        name: 'Acme Contact',
        email: 'jane@acme.com',
      });
      // No setEmail exists; updateProfile only takes name/company/tier.
      customer.updateProfile({ name: 'New Name' });
      expect(customer.getEmail()).toBe('jane@acme.com');
      expect(
        (customer as unknown as { setEmail?: unknown }).setEmail,
      ).toBeUndefined();
    });
  });

  describe('updateProfile()', () => {
    it('updates name, company and tier', () => {
      const customer = Customer.create({
        name: 'Acme Contact',
        email: 'jane@acme.com',
      });
      customer.updateProfile({
        name: 'Jane Doe',
        company: 'Acme Corp',
        tier: 'PRO',
      });
      expect(customer.getName()).toBe('Jane Doe');
      expect(customer.getCompany()).toBe('Acme Corp');
      expect(customer.getTier()).toBe(CustomerTierEnum.PRO);
    });

    it('throws on invalid tier', () => {
      const customer = Customer.create({ name: 'A', email: 'a@b.com' });
      expect(() => customer.updateProfile({ tier: 'GOLD' })).toThrow(
        InvalidCustomerTierError,
      );
    });

    it('throws on invalid name', () => {
      const customer = Customer.create({ name: 'A', email: 'a@b.com' });
      expect(() => customer.updateProfile({ name: '' })).toThrow(
        InvalidCustomerNameError,
      );
    });
  });

  describe('deactivate()', () => {
    it('transitions ACTIVE -> INACTIVE', () => {
      const customer = Customer.create({ name: 'A', email: 'a@b.com' });
      customer.deactivate();
      expect(customer.getCustomerStatus()).toBe(CustomerStatusEnum.INACTIVE);
    });

    it('throws when already INACTIVE (deactivate twice)', () => {
      const customer = Customer.create({ name: 'A', email: 'a@b.com' });
      customer.deactivate();
      expect(() => customer.deactivate()).toThrow(CustomerAlreadyInactiveError);
    });
  });
});
