export class CannotFailValidationError extends Error {
  constructor() {
    super('Can only fail validation on draft orders');
    this.name = 'CannotFailValidationError';
  }
}
