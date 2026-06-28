export class InvalidProductPriceError extends Error {
  constructor(message = 'Invalid product price') {
    super(message);
    this.name = 'InvalidProductPriceError';
  }
}
