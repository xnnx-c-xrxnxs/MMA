export class InvalidPaymentStatusTransitionError extends Error {
  constructor(action: string, requiredStatus: string) {
    super(`Can only ${action} ${requiredStatus} payments`);
    this.name = 'InvalidPaymentStatusTransitionError';
  }
}
