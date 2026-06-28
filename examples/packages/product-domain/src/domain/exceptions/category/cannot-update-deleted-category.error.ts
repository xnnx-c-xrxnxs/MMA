export class CannotUpdateDeletedCategoryError extends Error {
  constructor() {
    super('Cannot update a deleted category');
    this.name = 'CannotUpdateDeletedCategoryError';
  }
}
