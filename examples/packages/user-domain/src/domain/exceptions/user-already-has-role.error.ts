export class UserAlreadyHasRoleError extends Error {
  constructor() {
    super('User already has this role');
    this.name = 'UserAlreadyHasRoleError';
  }
}
