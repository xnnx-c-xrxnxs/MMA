// Level 5 — entity that owns an immutable Value Object (Address).
export default {
  id: '05-customer-address',
  level: 5,
  complexityLabel: 'L5 · Value Object',
  domain: 'CRM',
  title: 'Customer (with Address)',
  introShort: 'Introduces an immutable Value Object that the entity composes.',
  intro: 'Some concepts are defined by their attributes, not their identity — an Address is the canonical example. Two addresses with identical fields are the same address. We model it as an immutable Value Object with its own validation, and the Customer entity holds one.',
  specTitle: 'CRM · Customer',
  specBodyHtml: `
    <p>A <strong>Customer</strong> represents a person we ship to.</p>
    <ul>
      <li>Required fields: <em>name</em>, <em>email</em>.</li>
      <li>Has a <em>shippingAddress</em>, which itself has: street, city, country (ISO-2), postalCode.</li>
      <li>Postal code: 5–10 alphanumeric characters.</li>
      <li>Country: exactly 2 uppercase letters (ISO-3166-1 alpha-2).</li>
      <li>The address is <em>immutable</em>. To change it, the customer's address is <em>replaced</em> with a brand-new <code>Address</code>.</li>
      <li>Two addresses with identical fields are equal — equality is by value, not by reference.</li>
    </ul>
  `,
  entityFilename: 'customer.entity.ts (+ address.value.ts)',
  entityCode: `// ── address.value.ts ─────────────────────────────────────────────────────
import { InvalidPostalCodeError, InvalidCountryCodeError } from '../exceptions';

/** Immutable Value Object — equality is by value, not identity. */
export class Address {
  private constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly country: string,
    public readonly postalCode: string
  ) {}

  static create(props: {
    street: string; city: string; country: string; postalCode: string;
  }): Address {
    if (!/^[A-Z]{2}$/.test(props.country)) throw new InvalidCountryCodeError();
    if (!/^[A-Z0-9]{5,10}$/i.test(props.postalCode)) throw new InvalidPostalCodeError();

    return new Address(
      props.street.trim(),
      props.city.trim(),
      props.country.toUpperCase(),
      props.postalCode.toUpperCase()
    );
  }

  /** Value equality — same fields ⇒ same Address. */
  equals(other: Address): boolean {
    return this.street === other.street
        && this.city === other.city
        && this.country === other.country
        && this.postalCode === other.postalCode;
  }
}

// ── customer.entity.ts ───────────────────────────────────────────────────
import { Address } from './address.value';
import { CustomerNameRequiredError, InvalidEmailFormatError } from '../exceptions';

export class Customer {
  private constructor(
    private readonly customerId: string | null,
    private name: string,
    private readonly email: string,
    private shippingAddress: Address,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { name: string; email: string; shippingAddress: Address }): Customer {
    if (props.name.trim().length === 0) throw new CustomerNameRequiredError();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(props.email)) throw new InvalidEmailFormatError();

    const now = new Date().toISOString();
    return new Customer(
      null,
      props.name.trim(),
      props.email.toLowerCase().trim(),
      props.shippingAddress,
      now, now
    );
  }

  /** The address is replaced wholesale — never mutated in place. */
  changeShippingAddress(newAddress: Address): void {
    if (this.shippingAddress.equals(newAddress)) return;   // no-op
    this.shippingAddress = newAddress;
    this.updatedAt = new Date().toISOString();
  }

  rename(newName: string): void {
    if (newName.trim().length === 0) throw new CustomerNameRequiredError();
    this.name = newName.trim();
    this.updatedAt = new Date().toISOString();
  }

  // Getters
  getCustomerId(): string | null { return this.customerId; }
  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
  getShippingAddress(): Address { return this.shippingAddress; }
}`,
  concepts: [
    'Value Object: identity is the value itself',
    'Immutable — replace, never mutate',
    'Self-validating in its own factory',
    'equals() defined on the value object, not the entity',
    'No-op short-circuit in the entity\'s changer',
  ],
  exceptionsFilename: 'crm-exceptions.ts (excerpt)',
  exceptionsCode: `export class InvalidCountryCodeError extends Error {
  constructor() { super('Country must be a 2-letter ISO-3166-1 code'); this.name = 'InvalidCountryCodeError'; }
}
export class InvalidPostalCodeError extends Error {
  constructor() { super('Postal code must be 5–10 alphanumeric characters'); this.name = 'InvalidPostalCodeError'; }
}
export class CustomerNameRequiredError extends Error {
  constructor() { super('Customer name is required'); this.name = 'CustomerNameRequiredError'; }
}
export class InvalidEmailFormatError extends Error {
  constructor() { super('Invalid email format'); this.name = 'InvalidEmailFormatError'; }
}`,
  pitfalls: [
    'Don\'t expose <code>address.street = ...</code> — Value Objects are read-only. Replace, don\'t mutate.',
    'Don\'t put address validation on the Customer entity — it belongs <em>inside</em> the Address VO so it cannot be bypassed.',
    'Don\'t add a database <code>id</code> to a Value Object. If you find yourself needing one, it\'s probably an entity, not a VO.',
  ],
};
