export class CannotDeactivateNonActiveProductError extends Error {
  constructor() {
    super('Can only deactivate active products');
    this.name = 'CannotDeactivateNonActiveProductError';
  }
}
