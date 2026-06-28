export class CannotApproveProductValidationError extends Error {
  constructor() {
    super('Can only approve product validation on draft orders');
    this.name = 'CannotApproveProductValidationError';
  }
}
