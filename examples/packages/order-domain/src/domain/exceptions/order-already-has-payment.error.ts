export class OrderAlreadyHasPaymentError extends Error {
  constructor() {
    super('Order already has payment attached');
    this.name = 'OrderAlreadyHasPaymentError';
  }
}
