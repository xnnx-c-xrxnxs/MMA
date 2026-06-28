export class CannotUpdateDeletedProductError extends Error {
  constructor(field?: string) {
    super(field ? `Cannot update ${field} of a deleted product` : 'Cannot update a deleted product');
    this.name = 'CannotUpdateDeletedProductError';
  }
}
