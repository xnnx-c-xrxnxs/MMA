export class CustomerAlreadyInactiveError extends Error {
  constructor() {
    super('Customer is already inactive');
    this.name = 'CustomerAlreadyInactiveError';
  }
}
