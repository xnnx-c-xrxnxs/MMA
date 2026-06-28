export class CannotRefundOrderError extends Error {
  constructor(reason: string) {
    super(`Cannot refund order: ${reason}`);
    this.name = 'CannotRefundOrderError';
  }
}
