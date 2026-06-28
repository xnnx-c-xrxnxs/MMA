export class CannotUpdateDiscontinuedProductError extends Error {
  constructor(field?: string) {
    super(field ? `Cannot update ${field} of a discontinued product` : 'Cannot update a discontinued product');
    this.name = 'CannotUpdateDiscontinuedProductError';
  }
}
