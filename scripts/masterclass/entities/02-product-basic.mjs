// Level 2 — input validation: required-field guards + range/format checks.
export default {
  id: '02-product-basic',
  level: 2,
  complexityLabel: 'L2 · Validation',
  domain: 'Catalog',
  title: 'Product (basic)',
  introShort: 'Adds field-level validation: max length, positive price, non-blank name.',
  intro: 'A basic Product introduces input validation in the create() factory. The same rules also apply when fields are updated — every mutating method funnels through the same guards. This is the simplest example of a typed domain exception per failure mode.',
  specTitle: 'Catalog · Product (basic)',
  specBodyHtml: `
    <p>A <strong>Product</strong> represents an item that can be sold.</p>
    <ul>
      <li>It has a <em>name</em> — required, non-blank, ≤ 100 characters.</li>
      <li>It has a <em>price</em> — must be strictly <em>greater than 0</em>.</li>
      <li>It has an optional <em>description</em>.</li>
      <li>The name, price, and description can all be updated after creation.</li>
      <li>Every update applies the same validation rules as creation.</li>
    </ul>
    <p>No status, no lifecycle — just a validated bag of fields.</p>
  `,
  entityFilename: 'product.entity.ts',
  entityCode: `import {
  ProductNameRequiredError,
  ProductNameTooLongError,
  InvalidProductPriceError,
} from '../exceptions';

export class Product {
  private constructor(
    private readonly productId: string | null,
    private name: string,
    private price: number,
    private description: string | null,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { name: string; price: number; description?: string }): Product {
    Product.validateName(props.name);
    Product.validatePrice(props.price);

    const now = new Date().toISOString();
    return new Product(
      null,
      props.name.trim(),
      props.price,
      props.description?.trim() ?? null,
      now,
      now
    );
  }

  static reconstitute(props: {
    productId: string;
    name: string;
    price: number;
    description: string | null;
    dateCreated: string;
    updatedAt: string;
  }): Product {
    return new Product(
      props.productId, props.name, props.price, props.description,
      props.dateCreated, props.updatedAt
    );
  }

  rename(newName: string): void {
    Product.validateName(newName);
    this.name = newName.trim();
    this.updatedAt = new Date().toISOString();
  }

  changePrice(newPrice: number): void {
    Product.validatePrice(newPrice);
    this.price = newPrice;
    this.updatedAt = new Date().toISOString();
  }

  updateDescription(description: string | null): void {
    this.description = description?.trim() ?? null;
    this.updatedAt = new Date().toISOString();
  }

  // Reusable invariants — same rule applies on create and on update.
  private static validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new ProductNameRequiredError();
    if (trimmed.length > 100) throw new ProductNameTooLongError();
  }

  private static validatePrice(price: number): void {
    if (!Number.isFinite(price) || price <= 0) throw new InvalidProductPriceError();
  }

  // Getters
  getProductId(): string | null { return this.productId; }
  getName(): string { return this.name; }
  getPrice(): number { return this.price; }
  getDescription(): string | null { return this.description; }
  getDateCreated(): string { return this.dateCreated; }
  getUpdatedAt(): string { return this.updatedAt; }
}`,
  concepts: [
    'Field-level validation in create()',
    'Same guard applied on create and on update',
    'Private static helpers for reusable invariants',
    'One typed exception per failure mode',
  ],
  exceptionsFilename: 'product-exceptions.ts',
  exceptionsCode: `export class ProductNameRequiredError extends Error {
  constructor() {
    super('Product name is required');
    this.name = 'ProductNameRequiredError';
  }
}

export class ProductNameTooLongError extends Error {
  constructor() {
    super('Product name cannot exceed 100 characters');
    this.name = 'ProductNameTooLongError';
  }
}

export class InvalidProductPriceError extends Error {
  constructor() {
    super('Price must be greater than 0');
    this.name = 'InvalidProductPriceError';
  }
}`,
  pitfalls: [
    'Don\'t duplicate validation between <code>create()</code> and <code>changePrice()</code> — extract a <code>private static validate*()</code> helper.',
    'Don\'t throw a generic <code>Error</code> — the <code>DomainExceptionFilter</code> can only map <em>typed</em> exceptions.',
    'Don\'t put validation in the controller via Zod and skip it here. Zod guards <em>shape</em>; the entity guards <em>business rules</em>.',
  ],
};
