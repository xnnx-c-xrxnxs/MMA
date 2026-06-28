export class InvalidOrderStatusTransitionError extends Error {
  constructor(action: string, requiredStatus: string) {
    super(`Can only ${action} ${requiredStatus} orders`);
    this.name = 'InvalidOrderStatusTransitionError';
  }
}
