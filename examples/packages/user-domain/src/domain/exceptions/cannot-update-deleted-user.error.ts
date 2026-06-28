export class CannotUpdateDeletedUserError extends Error {
  constructor(field: 'profile' | 'data' = 'profile') {
    super(`Cannot update deleted user ${field}`);
    this.name = 'CannotUpdateDeletedUserError';
  }
}
