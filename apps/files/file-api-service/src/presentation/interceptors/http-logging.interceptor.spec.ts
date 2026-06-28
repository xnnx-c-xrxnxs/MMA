import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

// ─── helpers ──────────────────────────────────────────────────────────────────

function createMockContext(
  method: string,
  path: string,
  statusCode: number,
  userId?: string,
): ExecutionContext {
  const req = { method, path, user: userId ? { userId } : undefined };
  const res = { statusCode };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function createCallHandler(value: unknown = {}): CallHandler {
  return { handle: () => of(value) };
}

function createThrowingCallHandler(err: unknown): CallHandler {
  return { handle: () => throwError(() => err) };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;

  beforeEach(() => {
    interceptor = new HttpLoggingInterceptor();
  });

  describe('successful requests (tap path)', () => {
    it('completes without throwing for a 200 response', (done) => {
      const ctx = createMockContext('GET', '/api/files/presigned-download/key', 200);
      interceptor.intercept(ctx, createCallHandler({ downloadUrl: 'https://x' })).subscribe({
        next: (val) => expect(val).toEqual({ downloadUrl: 'https://x' }),
        error: done.fail,
        complete: done,
      });
    });

    it('completes without throwing for a 201 response', (done) => {
      const ctx = createMockContext('POST', '/api/files/presigned-upload', 201);
      interceptor.intercept(ctx, createCallHandler({})).subscribe({
        next: jest.fn(),
        error: done.fail,
        complete: done,
      });
    });

    it('completes without throwing for a 4xx response', (done) => {
      const ctx = createMockContext('POST', '/api/files/presigned-upload', 400);
      interceptor.intercept(ctx, createCallHandler({})).subscribe({
        error: done.fail,
        complete: done,
      });
    });

    it('completes without throwing for a 5xx response (non-thrown)', (done) => {
      const ctx = createMockContext('GET', '/api/files/presigned-download/key', 500);
      interceptor.intercept(ctx, createCallHandler({})).subscribe({
        error: done.fail,
        complete: done,
      });
    });

    it('works when no authenticated user is present (public routes)', (done) => {
      const ctx = createMockContext('GET', '/api/health', 200);
      interceptor.intercept(ctx, createCallHandler({ status: 'ok' })).subscribe({
        error: done.fail,
        complete: done,
      });
    });

    it('works when authenticated user is present', (done) => {
      const ctx = createMockContext('POST', '/api/files/presigned-upload', 201, 'usr_actor_123');
      interceptor.intercept(ctx, createCallHandler({})).subscribe({
        error: done.fail,
        complete: done,
      });
    });
  });

  describe('thrown exceptions (catchError path)', () => {
    it('re-throws the original error', (done) => {
      const error = new Error('Something went wrong');
      const ctx = createMockContext('POST', '/api/files/presigned-upload', 200);
      interceptor.intercept(ctx, createThrowingCallHandler(error)).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
        complete: done.fail,
      });
    });

    it('re-throws with actorId in context', (done) => {
      const error = new Error('Upload failed');
      const ctx = createMockContext('POST', '/api/files/presigned-upload', 200, 'usr_actor_456');
      interceptor.intercept(ctx, createThrowingCallHandler(error)).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
        complete: done.fail,
      });
    });
  });
});
