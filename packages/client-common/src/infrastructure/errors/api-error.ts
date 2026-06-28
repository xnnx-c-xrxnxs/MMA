/**
 * Typed API error matching the backend's standardized error response shape:
 * { statusCode, error, message }
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound() {
    return this.statusCode === 404;
  }

  get isConflict() {
    return this.statusCode === 409;
  }

  get isValidationError() {
    return this.statusCode === 400;
  }

  get isServerError() {
    return this.statusCode >= 500;
  }
}
