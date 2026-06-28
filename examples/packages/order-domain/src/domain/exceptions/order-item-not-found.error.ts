export class OrderItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} not found in order`);
    this.name = 'OrderItemNotFoundError';
  }
}
