export class ProductAlreadyDeletedError extends Error {
  constructor() {
    super('Product is already deleted');
    this.name = 'ProductAlreadyDeletedError';
  }
}
