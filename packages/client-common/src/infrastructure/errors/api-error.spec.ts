import { ApiError } from './api-error';

describe('ApiError', () => {
  it('should store statusCode, error, and message', () => {
    const err = new ApiError(409, 'ConflictError', 'Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.error).toBe('ConflictError');
    expect(err.message).toBe('Already exists');
    expect(err.name).toBe('ApiError');
  });

  it.each([
    [404, 'isNotFound'],
    [409, 'isConflict'],
    [400, 'isValidationError'],
    [500, 'isServerError'],
    [502, 'isServerError'],
  ] as const)('status %i → %s = true', (code, getter) => {
    const err = new ApiError(code, 'E', 'msg');
    expect(err[getter]).toBe(true);
  });

  it('should be an instance of Error', () => {
    const err = new ApiError(500, 'E', 'msg');
    expect(err).toBeInstanceOf(Error);
  });
});
