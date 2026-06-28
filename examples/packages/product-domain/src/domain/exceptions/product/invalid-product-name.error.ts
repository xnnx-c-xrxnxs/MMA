export class InvalidProductNameError extends Error {
  constructor(message = 'Invalid product name') {
    super(message);
    this.name = 'InvalidProductNameError';
  }
}
