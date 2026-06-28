export class CannotConfirmEmptyOrderError extends Error {
  constructor() {
    super('Cannot confirm order with no items');
    this.name = 'CannotConfirmEmptyOrderError';
  }
}
