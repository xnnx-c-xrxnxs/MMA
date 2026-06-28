/**
 * ICustomerValidator
 *
 * Anti-Corruption Layer (ACL) port — defines what the Order domain needs
 * from the User bounded context WITHOUT coupling to its internal types.
 *
 * Implemented by an HTTP adapter in the service's infrastructure/clients/ layer.
 * Injected into use cases that need to validate customers.
 */
export interface ValidatedCustomer {
  /** The upstream customer's unique identifier. */
  customerId: string;
  /** The upstream customer's current status — only the values relevant to this domain. */
  status: string;
}

export abstract class ICustomerValidator {
  /**
   * Validate that the customer exists and is in a valid state.
   *
   * @returns The validated customer summary if valid.
   * @throws CustomerNotFoundError if the customer does not exist.
   * @throws CustomerInvalidStatusError if the customer exists but is not in a valid state.
   * @throws CustomerServiceUnavailableError if the upstream service is unreachable.
   */
  abstract validate(customerId: string): Promise<ValidatedCustomer>;
}
