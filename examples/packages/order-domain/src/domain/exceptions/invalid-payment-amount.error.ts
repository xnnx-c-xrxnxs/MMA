export class InvalidPaymentAmountError extends Error {
  constructor() {
    super('Payment amount must be greater than 0');
    this.name = 'InvalidPaymentAmountError';
  }
}
