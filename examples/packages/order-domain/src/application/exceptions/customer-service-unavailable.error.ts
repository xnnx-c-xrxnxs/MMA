/**
 * Thrown when the upstream user service is unreachable or returns an unexpected error.
 */
export class CustomerServiceUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? 'Customer validation service is unavailable');
    this.name = 'CustomerServiceUnavailableError';
  }
}
