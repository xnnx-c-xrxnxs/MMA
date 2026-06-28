export class InvalidCustomerNameError extends Error {
  constructor() {
    super('Customer name must be between 1 and 120 characters');
    this.name = 'InvalidCustomerNameError';
  }
}
