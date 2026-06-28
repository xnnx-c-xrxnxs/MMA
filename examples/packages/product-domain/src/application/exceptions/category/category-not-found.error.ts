export class CategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Category not found: ${categoryId}`);
    this.name = 'CategoryNotFoundError';
  }
}
