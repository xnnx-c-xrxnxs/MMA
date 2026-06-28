export class InvalidPaymentStateForConfirmationError extends Error {
  constructor() {
    super('Payment must be successful or pending');
    this.name = 'InvalidPaymentStateForConfirmationError';
  }
}
