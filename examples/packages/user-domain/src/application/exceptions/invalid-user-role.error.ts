export class InvalidUserRoleError extends Error {
  constructor(role: string) {
    super(`Invalid role: ${role}`);
    this.name = 'InvalidUserRoleError';
  }
}
