export class CannotChangeRoleOfDeletedUserError extends Error {
  constructor() {
    super('Cannot change role of deleted user');
    this.name = 'CannotChangeRoleOfDeletedUserError';
  }
}
