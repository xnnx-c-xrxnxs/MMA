export class CannotCancelOrderError extends Error {
  constructor() {
    super('Cannot cancel delivered or refunded orders');
    this.name = 'CannotCancelOrderError';
  }
}
