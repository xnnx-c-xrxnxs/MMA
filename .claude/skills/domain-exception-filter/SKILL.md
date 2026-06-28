---
name: domain-exception-filter
description: Implement or extend the DomainExceptionFilter that maps typed domain and application exceptions to HTTP status codes in a NestJS service. Use this when adding new exceptions to a domain and needing them to surface correctly as HTTP responses.
---

# Domain Exception Filter

---

## Purpose

The `DomainExceptionFilter` is a NestJS `ExceptionFilter` registered globally in `main.ts`. It:

1. Passes through any `HttpException` unchanged (e.g. `BadRequestException` thrown by `ZodValidationPipe`).
2. Inspects thrown errors against a `DOMAIN_ERROR_MAP` to determine the correct HTTP status.
3. Returns a structured `{ message, statusCode, timestamp }` response for all mapped exceptions.
4. Returns `500 Internal Server Error` for anything unmapped, and logs it with `Logger`.

---

## Full Implementation

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// ─── Domain / Application exceptions ─────────────────────────────────────────
import {
  {Entity}NotFoundError,
  {Entity}AlreadyExistsError,
  Invalid{Entity}StatusTransitionError,
} from '@mma/{domain}-domain';
import {
  InvalidInputError,
} from '@mma/{domain}-domain';  // application-layer exceptions

// ─── Error map ────────────────────────────────────────────────────────────────
// Each tuple: [ErrorConstructor, httpStatusCode]
// Order matters: more-specific subclasses must come before their parents.
const DOMAIN_ERROR_MAP: [new (...args: never[]) => Error, number][] = [
  // 404 — Not Found
  [{Entity}NotFoundError, HttpStatus.NOT_FOUND],

  // 409 — Conflict
  [{Entity}AlreadyExistsError, HttpStatus.CONFLICT],
  [Invalid{Entity}StatusTransitionError, HttpStatus.CONFLICT],

  // 400 — Bad Request (application-layer input errors)
  [InvalidInputError, HttpStatus.BAD_REQUEST],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Pass through NestJS/HTTP exceptions directly
    //    Use getResponse() — not .message — to preserve Zod issue arrays
    //    Log 4xx as warn (includes ZodValidationPipe BadRequestException), 5xx as error
    //    Always pair this.logger.* with console.* — NestJS Logger can be silenced by the
    //    application log level; console writes directly to stderr and is always visible.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (status >= 500) {
        this.logger.error(`[${exception.constructor.name}] ${status}`, exception.stack);
        console.error(`[DomainExceptionFilter] [${exception.constructor.name}] ${status}`, exception.stack);
      } else {
        this.logger.warn(`[${exception.constructor.name}] ${status} — ${JSON.stringify(res)}`);
        console.warn(`[DomainExceptionFilter] [${exception.constructor.name}] ${status} — ${JSON.stringify(res)}`);
      }
      response.status(status).json(
        typeof res === 'string'
          ? { statusCode: status, error: exception.constructor.name, message: res }
          : res,
      );
      return;
    }

    // 2. Check domain/application error map
    if (exception instanceof Error) {
      for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) {
        if (exception instanceof ErrorClass) {
          // Always log mapped errors so they are visible in the service terminal
          this.logger.warn(
            `[${exception.constructor.name}] ${exception.message}`,
          );
          console.warn(`[DomainExceptionFilter] [${exception.constructor.name}] ${exception.message}`);
          response.status(statusCode).json({
            statusCode,
            error: exception.constructor.name,
            message: exception.message,
          });
          return;
        }
      }
    }

    // 3. Unknown error — log with full detail and return 500 with error name + message
    const errorName =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const errorStack =
      exception instanceof Error ? exception.stack : String(exception);

    this.logger.error(`[${errorName}] ${errorMessage}`, errorStack);
    console.error(`[DomainExceptionFilter] [${errorName}] ${errorMessage}`, errorStack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message: errorMessage,
    });
  }
}
```

---

## Critical Rules

### 1. Always check `HttpException` first — and always log it with both `logger` and `console`

`HttpException` covers everything thrown by NestJS itself (`BadRequestException` from `ZodValidationPipe`, `NotFoundException`, etc.). It must be checked before the domain error map, and **must be logged** — otherwise Zod validation failures (400s) and other HTTP exceptions are silently swallowed with zero server-side output.

Always pair every `this.logger.*` call with the matching `console.warn`/`console.error`. The NestJS `Logger` is a DI-managed service — when the filter is instantiated outside the DI container (via `new DomainExceptionFilter()` in `main.ts`), NestJS may suppress its output based on the application log level or runtime context. `console.warn`/`console.error` write directly to stderr and are **always** visible in the terminal regardless of NestJS configuration.

```typescript
// Correct — check first, log by severity, always use both logger + console
if (exception instanceof HttpException) {
  const status = exception.getStatus();
  const res = exception.getResponse();
  if (status >= 500) {
    this.logger.error(`[${exception.constructor.name}] ${status}`, exception.stack);
    console.error(`[DomainExceptionFilter] [${exception.constructor.name}] ${status}`, exception.stack);
  } else {
    this.logger.warn(`[${exception.constructor.name}] ${status} — ${JSON.stringify(res)}`);
    console.warn(`[DomainExceptionFilter] [${exception.constructor.name}] ${status} — ${JSON.stringify(res)}`);
  }
  response.status(status).json(res);
  return;
}

// Wrong — silent, no logging at all
if (exception instanceof HttpException) {
  response.status(exception.getStatus()).json(exception.getResponse());
  return;
}

// Wrong — logger only, may be silenced by NestJS log level in some runtime contexts
if (exception instanceof HttpException) {
  this.logger.warn(...);
  response.status(exception.getStatus()).json(exception.getResponse());
  return;
}

// Wrong — this would catch BadRequestException before mapping Zod errors
for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) { ... }
```

---

### 2. Always log mapped domain errors with both `logger.warn()` and `console.warn()`

Every matched entry in `DOMAIN_ERROR_MAP` **must** call both `this.logger.warn()` and `console.warn()` before returning the response. See Rule 1 for why `console.*` is required alongside the NestJS logger.

```typescript
// Correct
this.logger.warn(`[${exception.constructor.name}] ${exception.message}`);
console.warn(`[DomainExceptionFilter] [${exception.constructor.name}] ${exception.message}`);
response.status(statusCode).json({ ... });

// Wrong — silent, no server-side feedback
response.status(statusCode).json({ ... });

// Wrong — logger only, may be silenced
this.logger.warn(...);
response.status(statusCode).json({ ... });
```

Only the unmapped 500 fallthrough needs `this.logger.error()` + `console.error()` (it already fires there).

---

### 3. Use `getResponse()` not `.message` for HttpExceptions

`ZodValidationPipe` throws `BadRequestException` with an array of Zod issues as the response body. Using `.message` would discard that detail.

```typescript
// Correct
response.status(status).json(exception.getResponse());   // preserves Zod issues array

// Wrong
response.status(status).json({ message: exception.message });  // loses Zod issues
```

### 4. Sub-class ordering in `DOMAIN_ERROR_MAP`

If `EntityNotFoundError extends DomainError` and you also map `DomainError`, put the sub-class **first** in the array.

---

## HTTP Status Code Reference

| Exception type | HTTP status | When to use |
|---|---|---|
| `{Entity}NotFoundError` | 404 | Entity with given ID does not exist |
| `{Entity}AlreadyExistsError` | 409 | Unique constraint violated (duplicate email, etc.) |
| `Invalid{Entity}StatusTransitionError` | 409 | State machine rule violated |
| `InvalidInputError` (app layer) | 400 | Invalid input caught before use case |
| ACL: `{Upstream}NotFoundError` | 404 | Upstream entity not found during cross-service validation |
| ACL: `{Upstream}InvalidStatusError` | 409 | Upstream entity in wrong state for this operation |
| ACL: `{Upstream}ServiceUnavailableError` | 502 (BAD_GATEWAY) | Upstream service timed out or returned 5xx |
| Unmapped error | 500 | Unexpected — log it |

### ACL Exception Mapping

When a service uses the `sync-cross-service-call` pattern, the ACL adapter throws domain-specific exceptions that must be mapped in this filter. Add them to `DOMAIN_ERROR_MAP` with a comment block:

```typescript
const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  // ... domain exceptions ...

  // ACL — Cross-service {upstream} validation
  [{Upstream}NotFoundError, HttpStatus.NOT_FOUND],
  [{Upstream}InvalidStatusError, HttpStatus.CONFLICT],
  [{Upstream}ServiceUnavailableError, HttpStatus.BAD_GATEWAY],
];
```

**Rule:** ACL exceptions are imported from the **consuming domain's** domain package (`@mma/{consuming-domain}-domain`), not from the upstream service. The ACL adapter maps HTTP errors to these domain exceptions — see the `sync-cross-service-call` skill.

### Standardized Error Response Shape

All services must use the **same JSON shape** for domain-mapped and fallback error responses:

```json
{
  "statusCode": 409,
  "error": "CannotModifyNonDraftOrderError",
  "message": "Cannot add items to a non-draft order"
}
```

| Field | Purpose |
|---|---|
| `statusCode` | HTTP status code (number) |
| `error` | Exception class name — useful for debugging and client-side error handling |
| `message` | Human-readable error description |

**Do NOT add `timestamp`** to error responses. Timestamps belong in server-side logs, not in API responses. Some older code may include `timestamp` — when updating a filter, remove it to match this standard.

---

## How to Add a New Exception

When a new domain or application exception is created, update the filter in three steps:

**Step 1** — Import the new exception class:
```typescript
import { NewDomainError } from '@mma/{domain}-domain';
```

**Step 2** — Append it to `DOMAIN_ERROR_MAP` with the correct HTTP status:
```typescript
const DOMAIN_ERROR_MAP: ... = [
  // ... existing entries
  [NewDomainError, HttpStatus.CONFLICT],  // ← add here
];
```

**Step 3** — If this is a new domain's filter (new service), create a new filter in:
```
apps/{domain}/{service}/src/presentation/filters/domain-exception.filter.ts
```

Copy the entire template from this skill and replace the import section with the domain's exception classes.

---

## Registration in `main.ts`

```typescript
import { DomainExceptionFilter } from './presentation';

const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new DomainExceptionFilter());  // must be before listen()
```

---

## Barrel Export

Add to `src/presentation/index.ts`:
```typescript
export { DomainExceptionFilter } from './filters/domain-exception.filter';
```
