export class CustomerIdRequiredError extends Error {
  constructor() {
    super('Customer ID is required');
    this.name = 'CustomerIdRequiredError';
  }
}
