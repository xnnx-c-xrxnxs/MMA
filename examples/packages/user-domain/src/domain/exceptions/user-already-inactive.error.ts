export class UserAlreadyInactiveError extends Error {
  constructor() {
    super('User is already inactive');
    this.name = 'UserAlreadyInactiveError';
  }
}
