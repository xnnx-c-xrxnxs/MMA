export class InvalidOrderStatusError extends Error {
  constructor(status: string) {
    super(`Invalid order status: ${status}`);
    this.name = 'InvalidOrderStatusError';
  }
}
