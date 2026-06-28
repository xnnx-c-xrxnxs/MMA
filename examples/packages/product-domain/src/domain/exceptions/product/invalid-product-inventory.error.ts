export class InvalidProductInventoryError extends Error {
  constructor(message = 'Invalid product inventory') {
    super(message);
    this.name = 'InvalidProductInventoryError';
  }
}
