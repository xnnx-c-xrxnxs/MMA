export class CannotDiscontinueProductError extends Error {
  constructor() {
    super('Can only discontinue active or inactive products');
    this.name = 'CannotDiscontinueProductError';
  }
}
