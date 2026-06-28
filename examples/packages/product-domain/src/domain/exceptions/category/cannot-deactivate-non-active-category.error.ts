export class CannotDeactivateNonActiveCategoryError extends Error {
  constructor() {
    super('Can only deactivate active categories');
    this.name = 'CannotDeactivateNonActiveCategoryError';
  }
}
