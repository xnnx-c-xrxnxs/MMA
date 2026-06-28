export class InvalidEmailFormatError extends Error {
  constructor() {
    super('Invalid email format');
    this.name = 'InvalidEmailFormatError';
  }
}
