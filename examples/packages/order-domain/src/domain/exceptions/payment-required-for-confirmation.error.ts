export class PaymentRequiredForConfirmationError extends Error {
  constructor() {
    super('Payment required before confirmation');
    this.name = 'PaymentRequiredForConfirmationError';
  }
}
