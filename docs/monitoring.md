# Monitoring & Observability

This template ships with full observability built on three pillars:

| Pillar | Implementation |
|---|---|
| **Structured logging** | `@old-st/telemetry` `createLogger()` → JSON stdout → CloudWatch Logs |
| **Distributed tracing** | OpenTelemetry SDK + AWS X-Ray (active in deployed environments) |
| **Request correlation** | `correlationMiddleware()` + `AsyncLocalStorage` → `correlationId` in every log line |

The internal **monitoring tool** (`apps/monitoring/`) consumes these signals to provide an in-house dashboard for X-Ray traces, CloudWatch alarms, and per-service metrics.

> The interactive walkthrough is at [html/monitoring.html](html/monitoring.html). This page is the implementer's reference.

---

## The `@old-st/telemetry` Package

All backend services depend on `@old-st/telemetry`. It provides four exports:

### `initTelemetry(serviceName)`

Bootstraps the OpenTelemetry SDK. **Must be called before `NestFactory.create()`** in every `main.ts`.

```ts
// apps/{domain}/{service}/src/main.ts
import { initTelemetry } from '@old-st/telemetry';

initTelemetry('user-api-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ...
}
```

Locally, `OTEL_SDK_DISABLED=true` makes this a no-op. In Lambda, the SDK exports spans via the X-Ray exporter (no separate ADOT layer needed).

### `createLogger(serviceName): StructuredLogger`

**Module-level singleton.** Replaces `new Logger()` from `@nestjs/common`.

```ts
// app service, repository, dispatcher, etc.
import { createLogger } from '@old-st/telemetry';

const logger = createLogger('user-application-service');

export class UserApplicationService {
  async createUser(input: CreateUserInput) {
    logger.info('Creating user', { email: input.email });
    try {
      // ...
    } catch (err) {
      logger.error('Create user failed', { email: input.email }, err);
      throw err;
    }
  }
}
```

Every log line is JSON to stdout with these fields:

```json
{
  "timestamp": "2026-04-12T10:23:01.456Z",
  "level": "info",
  "service": "user-application-service",
  "message": "Creating user",
  "traceId": "abc123...",
  "spanId": "def456...",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@example.com"
}
```

Why a singleton (not a class property)? Because `correlationId` and `traceId` come from `AsyncLocalStorage` — they don't need to be instance state. Enforced by `app-service-has-logger` lint check.

### `correlationMiddleware()`

Express middleware that generates (or reuses incoming) `x-correlation-id` per request, stores it in `AsyncLocalStorage`, and ensures the logger picks it up.

```ts
// apps/{domain}/{service}/src/main.ts
import { correlationMiddleware } from '@old-st/telemetry';

function setupGlobalMiddleware(app: INestApplication) {
  app.use(correlationMiddleware());        // FIRST — before CORS, before global prefix
  app.enableCors({ origin: process.env.FE_BASE_URL, credentials: true });
  app.setGlobalPrefix('api');
}
```

### `getCorrelationHeaders()` + `runWithCorrelationId()`

For propagation into outbound calls:

```ts
// ACL adapter — outbound HTTP
import { getCorrelationHeaders } from '@old-st/telemetry';

await this.http.axiosRef.get(url, {
  headers: { ...getCorrelationHeaders() },   // x-correlation-id forwarded
});

// SQS event handler — wrap event processing
import { runWithCorrelationId } from '@old-st/telemetry';

const correlationId = body.correlationId ?? crypto.randomUUID();
await runWithCorrelationId(correlationId, () => this.handle(body));
```

SQS publishers in `@old-st/aws-sqs` automatically inject `correlationId` from `getCorrelationId()` into the event body — no manual work required on the publisher side.

---

## How CorrelationId Flows End-to-End

```
HTTP request
  ↓ x-correlation-id header (or generated UUID)
correlationMiddleware  →  AsyncLocalStorage
  ↓
NestJS controller, app service, use case  →  logger.info auto-includes correlationId
  ↓
ACL outbound HTTP  →  getCorrelationHeaders() forwards header
  ↓
Downstream service receives x-correlation-id  →  same correlationId in its logs
  ↓
SQS publisher  →  injects correlationId into event body
  ↓
SQS consumer  →  extracts + runWithCorrelationId  →  same correlationId in handler logs
```

Result: a single CloudWatch Logs Insights query filtered by `correlationId` returns the **complete chain across all services** — no X-Ray dependency needed for this view.

---

## CloudWatch Alarms

The `infra/modules/monitoring` Terraform module creates alarms from `service-registry.json`:

| Alarm | Threshold | Source |
|---|---|---|
| Lambda errors | `>= 1` over 5 min | `AWS/Lambda` `Errors` metric |
| Lambda throttles | `>= 1` over 5 min | `AWS/Lambda` `Throttles` metric |
| Lambda duration p99 | per service `timeout * 0.8` | `AWS/Lambda` `Duration` p99 |
| SQS DLQ messages | `>= 1` | `AWS/SQS` `ApproximateNumberOfMessagesVisible` on `*-dlq` queues |
| API Gateway 5xx | `>= 5` over 5 min | `AWS/ApiGateway` `5xx` |

Alarm actions route to the **notifications module** — see [notifications.md](notifications.md).

To wire alarms to a new service, follow the `add-monitoring` skill.

---

## The Monitoring Tool (`apps/monitoring/`)

An internal Next.js dashboard + NestJS API — **not for end users**. Deployed as Lambda container images (one per environment) with their own Function URLs.

| Component | Purpose |
|---|---|
| `monitoring-api-service` | Reads X-Ray traces, CloudWatch alarms, and service metrics via AWS SDK. JWT-protected (single internal user, password in Secrets Manager). |
| `monitoring-webapp` | Next.js dashboard. Sends requests with `Bearer token` + `X-Target-Environment` header so one deployment can switch between dev/staging/prod. |
| `packages/monitoring-sdk/` | Lambda + X-Ray providers used by the API service. |

**Deploying the monitoring tool:** see `docs/deployment.md` §12 ("Monitoring Deployments"). Triggered via `cd-monitoring-deploy.yml` workflow or the `Monitoring Deploy: Trigger` VS Code task.

**Authentication:** session-token in localStorage (internal tool only — *not* a pattern for production user-facing apps).

---

## Adding Observability to a New Service

When you scaffold a new service:

1. ✅ Add `"@old-st/telemetry": "workspace:*"` to the service's `package.json`.
2. ✅ Call `initTelemetry('{service-name}')` in `main.ts` **before** `NestFactory.create()`.
3. ✅ Add `app.use(correlationMiddleware())` as the **first** middleware in `setupGlobalMiddleware()`.
4. ✅ Use `const logger = createLogger('{name}')` at module scope in every app service, dispatcher, and ACL adapter.
5. ✅ ACL adapters spread `...getCorrelationHeaders()` into outbound HTTP headers.
6. ✅ SQS event handlers extract `correlationId` from the event body and wrap processing in `runWithCorrelationId(correlationId, () => ...)`.
7. ✅ Register CloudWatch alarms (automatic via `service-registry.json` — no Terraform edit needed).

The `add-monitoring` skill guides you through all seven steps. The `app-service-has-logger` lint check catches missing loggers in CI.
