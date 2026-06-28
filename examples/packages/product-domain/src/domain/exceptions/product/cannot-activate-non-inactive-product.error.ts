export class CannotActivateNonInactiveProductError extends Error {
  constructor() {
    super('Can only activate inactive products');
    this.name = 'CannotActivateNonInactiveProductError';
  }
}
