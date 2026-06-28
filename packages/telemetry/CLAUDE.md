# Telemetry Package Context

This file loads automatically for any file inside `packages/telemetry/`. The package is the **single source of truth** for structured logging, OpenTelemetry tracing, and request correlation across all backend services.

---

## What This Package Provides

| Export | Purpose |
|---|---|
| `initTelemetry(serviceName)` | OTel SDK bootstrap. Call **before** `NestFactory.create()` in every `main.ts`. No-op when `OTEL_SDK_DISABLED=true`. |
| `createLogger(serviceName)` | Returns a `StructuredLogger`. Used as a module-level singleton — never an instance property. |
| `correlationMiddleware()` | Express middleware that generates/reuses `x-correlation-id` and stores it in `AsyncLocalStorage`. MUST be the **first** middleware (before CORS). |
| `runWithCorrelationId(id, fn)` | For non-HTTP entry points (SQS handlers, scheduled jobs) to set the correlationId context. |
| `getCorrelationId()` | Read the current correlationId from AsyncLocalStorage. |
| `getCorrelationHeaders()` | Returns `{ 'x-correlation-id': '...' }` — spread into outbound HTTP headers (ACL adapters). |
| `injectTraceContext(messageAttributes)` | Add `traceparent` + `tracestate` to SQS MessageAttributes (publisher side). |
| `extractTraceContext(messageAttributes)` | Parse trace context from SQS MessageAttributes (consumer side). |

---

## Architectural Rules (Strictly Enforced)

1. **`initTelemetry` MUST run before `NestFactory.create`.** OTel auto-instrumentation patches modules at import time. If NestJS imports happen first, instrumentation is silently skipped.

2. **`createLogger` MUST be a module-level singleton.** Never `new Logger()` from `@nestjs/common`. Never store a logger as an instance property — `correlationId` and `traceId` come from AsyncLocalStorage, not from instance state. Enforced by `app-service-has-logger` lint check.

3. **`correlationMiddleware` MUST be the first middleware.** Before CORS, before global prefix. Otherwise some requests won't have a correlationId stored in time for downstream handlers.

4. **All log output is JSON to stdout.** Never use `console.log` in service code. The logger formats every line as JSON with `timestamp`, `level`, `service`, `message`, `traceId`, `spanId`, `correlationId`, plus user-provided fields.

5. **`logger.error()` accepts an optional third arg `error?: unknown`.** Serialised as `errorType`, `errorMessage`, `stack`. Don't manually stringify exceptions — pass the raw `Error` object.

6. **SQS publishers in `@mma/aws-sqs` auto-inject `correlationId` and trace context.** Don't add it manually in publisher code. Consumers MUST call `extractTraceContext` and `runWithCorrelationId` — if missing, traces appear disconnected in X-Ray.

---

## When to Modify This Package

| Goal | Action |
|---|---|
| Add a new log field globally | Edit `createLogger` to include the field in `_emit` |
| Add a new export | Add to `src/index.ts` barrel + add to the table above |
| Change OTel exporter (e.g. add OTLP HTTP) | Edit `src/tracer.ts` |
| Change correlationId header name | Edit `src/correlation.ts` AND update all ACL adapters that use `getCorrelationHeaders()` |
| Add a new propagation format (e.g. AWS-X-Amzn-Trace-Id) | Edit `src/sqs-propagation.ts` |

Most service-level work does **not** touch this package — it is consumed, not modified.

---

## Anti-Patterns

- ❌ **`new Logger('MyService')` from `@nestjs/common`** — use `createLogger('my-service')` instead.
- ❌ **`logger.info('user created: ' + email)`** — pass structured fields: `logger.info('User created', { email })`.
- ❌ **Calling `initTelemetry` after `NestFactory.create`** — instrumentation already missed the imports.
- ❌ **`app.use(corsMiddleware); app.use(correlationMiddleware())`** — wrong order. Correlation must be first.
- ❌ **Reading `req.headers['x-correlation-id']` manually in a controller** — use `getCorrelationId()` so it works in non-HTTP contexts too.
- ❌ **Storing logger as `private readonly logger = createLogger(...)` in a class** — declare as a module-level `const` instead.

---

## Reference Documentation

- `docs/monitoring.md` — high-level architecture
- `.claude/skills/add-monitoring/SKILL.md` — step-by-step skill for wiring observability to a new service
- `.claude/skills/xray-adot-setup/SKILL.md` — X-Ray-specific tracing patterns
