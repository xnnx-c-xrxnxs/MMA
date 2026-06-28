export class CannotModifyNonDraftOrderError extends Error {
  constructor(action: string) {
    super(`Can only ${action} items in draft orders`);
    this.name = 'CannotModifyNonDraftOrderError';
  }
}
