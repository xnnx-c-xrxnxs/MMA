export class CannotDeactivateDeletedUserError extends Error {
  constructor() {
    super('Cannot deactivate deleted user');
    this.name = 'CannotDeactivateDeletedUserError';
  }
}
