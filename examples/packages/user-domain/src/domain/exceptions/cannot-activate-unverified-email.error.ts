export class CannotActivateUnverifiedEmailError extends Error {
  constructor() {
    super('Cannot activate user with unverified email');
    this.name = 'CannotActivateUnverifiedEmailError';
  }
}
