export class InvalidUserStatusError extends Error {
  constructor(status: string) {
    super(`Invalid status: ${status}`);
    this.name = 'InvalidUserStatusError';
  }
}
