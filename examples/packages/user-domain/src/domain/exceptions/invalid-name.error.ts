export class InvalidNameError extends Error {
  constructor(field: 'First name' | 'Last name') {
    super(`${field} cannot be empty`);
    this.name = 'InvalidNameError';
  }
}
