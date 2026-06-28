export class CustomerNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Customer not found: ${identifier}`);
    this.name = 'CustomerNotFoundError';
  }
}
