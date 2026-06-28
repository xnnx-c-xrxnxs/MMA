// ─── HTTP Access Log Interceptor ─────────────────────────────────────────────
//
// Logs every inbound HTTP request + response as a single structured line:
//
//   { "message": "POST /api/files/presigned-upload → 201 in 34ms",
//     "method": "POST", "path": "/api/files/presigned-upload",
//     "statusCode": 201, "durationMs": 34,
//     "actorId": "usr_123",          ← from JWT (absent on public routes)
//     "correlationId": "abc-...",    ← from correlationMiddleware
//     "traceId": "...", "service": "file-api-service" }
//
// Log level:
//   INFO  for 2xx / 3xx
//   WARN  for 4xx (client errors — caller's fault, but worth tracking)
//   ERROR for 5xx (server faults)
//
// Placed in presentation/interceptors/ as a per-service copy (same convention
// as JwtAuthGuard and @CurrentUser) — no framework import in @mma/telemetry.
//
// Registration (main.ts):
//   app.useGlobalInterceptors(new HttpLoggingInterceptor());

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { createLogger } from '@mma/telemetry';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const logger = createLogger('file-api-service');

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { user?: AuthenticatedUser }>();

    const method = req.method;
    // Use pathname only — never log query strings (may contain tokens / PII)
    const path = req.path;
    const actorId = req.user?.userId;
    const startMs = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = ctx.getResponse<Response>();
        const statusCode = res.statusCode;
        const durationMs = Date.now() - startMs;
        const message = `${method} ${path} → ${statusCode} in ${durationMs}ms`;
        const fields = { method, path, statusCode, durationMs, ...(actorId ? { actorId } : {}) };

        if (statusCode >= 500) {
          logger.error(message, fields);
        } else if (statusCode >= 400) {
          logger.warn(message, fields);
        } else {
          logger.info(message, fields);
        }
      }),
      catchError((err: unknown) => {
        // Exception filters run after the interceptor catchError, so the status
        // code on the response object may still be 200 at this point.
        // Log the error here so the access log always captures 5xx from thrown
        // exceptions — the exception filter will handle the HTTP response shape.
        const durationMs = Date.now() - startMs;
        const statusCode = 500;
        const message = `${method} ${path} → ${statusCode} in ${durationMs}ms`;
        logger.error(message, { method, path, statusCode, durationMs, ...(actorId ? { actorId } : {}) }, err);
        return throwError(() => err);
      }),
    );
  }
}
