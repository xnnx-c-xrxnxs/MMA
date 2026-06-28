export class CustomerAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Customer already exists with email: ${email}`);
    this.name = 'CustomerAlreadyExistsError';
  }
}
