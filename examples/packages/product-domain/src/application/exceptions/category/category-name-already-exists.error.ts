export class CategoryNameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Category name already exists: ${name}`);
    this.name = 'CategoryNameAlreadyExistsError';
  }
}
