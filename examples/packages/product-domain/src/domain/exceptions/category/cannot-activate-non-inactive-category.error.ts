export class CannotActivateNonInactiveCategoryError extends Error {
  constructor() {
    super('Can only activate inactive categories');
    this.name = 'CannotActivateNonInactiveCategoryError';
  }
}
