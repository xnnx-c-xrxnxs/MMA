export class CategoryAlreadyDeletedError extends Error {
  constructor() {
    super('Category is already deleted');
    this.name = 'CategoryAlreadyDeletedError';
  }
}
