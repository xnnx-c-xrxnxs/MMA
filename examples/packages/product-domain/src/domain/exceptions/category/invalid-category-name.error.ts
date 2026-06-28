export class InvalidCategoryNameError extends Error {
  constructor(message = 'Invalid category name') {
    super(message);
    this.name = 'InvalidCategoryNameError';
  }
}
