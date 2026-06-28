export class OrderNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Order not found: ${identifier}`);
    this.name = 'OrderNotFoundError';
  }
}
