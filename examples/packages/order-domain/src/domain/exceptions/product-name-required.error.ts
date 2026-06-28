export class ProductNameRequiredError extends Error {
  constructor() {
    super('Product name is required');
    this.name = 'ProductNameRequiredError';
  }
}
