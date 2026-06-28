export class InvalidPaymentMethodError extends Error {
  constructor(method: string) {
    super(`Invalid payment method: ${method}`);
    this.name = 'InvalidPaymentMethodError';
  }
}
