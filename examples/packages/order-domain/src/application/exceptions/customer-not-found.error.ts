/**
 * Thrown when the upstream customer does not exist.
 */
export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer ${customerId} not found in upstream service`);
    this.name = 'CustomerNotFoundError';
  }
}
