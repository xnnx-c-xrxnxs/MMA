/**
 * Thrown when the upstream customer exists but is in an invalid state
 * for the current operation (e.g. DELETED, PENDING).
 */
export class CustomerInvalidStatusError extends Error {
  constructor(customerId: string, status: string) {
    super(`Customer ${customerId} has invalid status: ${status}`);
    this.name = 'CustomerInvalidStatusError';
  }
}
