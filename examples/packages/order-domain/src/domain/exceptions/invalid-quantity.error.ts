export class InvalidQuantityError extends Error {
  constructor() {
    super('Quantity must be greater than 0');
    this.name = 'InvalidQuantityError';
  }
}
