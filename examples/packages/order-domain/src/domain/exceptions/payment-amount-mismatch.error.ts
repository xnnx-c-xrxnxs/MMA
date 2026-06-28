export class PaymentAmountMismatchError extends Error {
  constructor() {
    super('Payment amount must match order total');
    this.name = 'PaymentAmountMismatchError';
  }
}
