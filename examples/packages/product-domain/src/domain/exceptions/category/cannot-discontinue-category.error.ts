export class CannotDiscontinueCategoryError extends Error {
  constructor() {
    super('Can only discontinue active or inactive categories');
    this.name = 'CannotDiscontinueCategoryError';
  }
}
