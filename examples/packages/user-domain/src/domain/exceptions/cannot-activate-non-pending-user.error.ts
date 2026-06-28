export class CannotActivateNonPendingUserError extends Error {
  constructor() {
    super('Can only activate pending users');
    this.name = 'CannotActivateNonPendingUserError';
  }
}
