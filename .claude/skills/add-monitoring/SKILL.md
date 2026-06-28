---
name: add-monitoring
description: Wire CloudWatch alarms and structured logging to a new service. Use this when adding observability to a new domain's Lambda functions or SQS queues — connecting them to the existing monitoring module and adding NestJS structured logging.
---

# Add Monitoring to a New Service

Canonical references:
- `infra/modules/monitoring/main.tf` — CloudWatch alarm resources
- `infra/modules/monitoring/variables.tf` — `lambda_functions` and `dlq_arns` maps
- `infra/environments/dev/main.tf` — how `module.monitoring` is called per environment

---

## What Gets Monitored

The monitoring module creates two alarm types automatically:

| Alarm | Metric | Threshold | Action needed |
|---|---|---|---|
| Lambda error alarm | `AWS/Lambda > Errors` | `> var.lambda_error_threshold` per 5 min | Add function name to `lambda_functions` map |
| SQS DLQ alarm | `AWS/SQS > ApproximateNumberOfMessagesVisible` | `> 0` | Add DLQ name to `dlq_arns` map |

---

## Part 1 — Terraform: Wire Alarms

### Step 1 — Find the monitoring module call in each environment root

In `infra/environments/{env}/main.tf`, find the existing `module "monitoring"` block. It looks like this:

```hcl
module "monitoring" {
  source = "../../modules/monitoring"

  name_prefix            = "${var.project_name}-${var.environment}"
  enable_alarms          = var.enable_alarms
  lambda_error_threshold = var.lambda_error_threshold

  lambda_functions = {
    user-api    = module.api_services["user-api-service"].function_name
    product-api = module.api_services["product-api-service"].function_name
    order-api   = module.api_services["order-api-service"].function_name
    # ... existing services
  }

  dlq_arns = {
    user-events    = module.sqs["USER_EVENTS_SQS_QUEUE_URL"].dlq_arn
    product-events = module.sqs["PRODUCT_EVENTS_SQS_QUEUE_URL"].dlq_arn
    order-events   = module.sqs["ORDER_EVENTS_SQS_QUEUE_URL"].dlq_arn
    # ... existing queues
  }

  tags = var.tags
}
```

### Step 2 — Add your new service's Lambda function name

Add one entry to `lambda_functions` per new API service and per new event handler service:

```hcl
lambda_functions = {
  # ... existing entries ...
  {domain}-api     = module.api_services["{domain}-api-service"].function_name
  {domain}-worker  = module.worker_services["{domain}-event-handler-service"].function_name
}
```

**Key naming:** Use a short descriptive key (not the full Nx project name). The key becomes part of the CloudWatch alarm name: `{key}-errors`.

### Step 3 — Add your new service's DLQ name

Every SQS queue created by the `sqs` module has a DLQ automatically. Add one entry per new queue:

```hcl
dlq_arns = {
  # ... existing entries ...
  {domain}-events = module.sqs["{DOMAIN}_EVENTS_SQS_QUEUE_URL"].dlq_name
}
```

The `for_each` key in `module.sqs` matches the `envVar` field of the queue entry in `service-registry.json`. Check that value if unsure.

### Step 4 — Repeat for all four environment roots

Update `dev/main.tf`, `staging/main.tf`, `prod/main.tf`, and `preview/main.tf`.

**Preview note:** Preview environments use `enable_alarms = false` — no alarm resources are created. The `lambda_functions` and `dlq_arns` maps are still written but ignored when `enable_alarms = false`. You can add the entries anyway so the module stays consistent.

---

## Part 2 — Structured Logging with `@mma/telemetry`

All NestJS services use `createLogger()` from `@mma/telemetry` — **never** `new Logger()` from `@nestjs/common`. This emits structured JSON to stdout, which Lambda ships to CloudWatch Logs. Every line automatically includes the active `correlationId` (from `correlationMiddleware()` or `runWithCorrelationId()`), plus OTel trace ID and span ID when available. The monitoring dashboard uses `correlationId` to group related logs into end-to-end event chains across services.

### Log Output Format

Each log line is a single JSON object:

```json
{
  "timestamp": "2026-04-16T10:23:45.123Z",
  "level": "INFO",
  "service": "user-api-service",
  "message": "User created",
  "traceId": "1-abc123...",
  "spanId": "def456...",
  "correlationId": "a3f2c8d1-7e4b-4f9a-b6c2-1d8e5f0a3b7c",
  "userId": "usr_abc",
  "email": "user@example.com"
}
```

The `correlationId` is automatically injected by the `correlationMiddleware()` (HTTP services) or `runWithCorrelationId()` (event handlers). It enables end-to-end request tracing across all services — the monitoring dashboard groups all logs sharing the same `correlationId` into a single "event chain".

Errors additionally include `errorType`, `errorMessage`, and `stack`.

### How to Declare a Logger

Declare a **module-level singleton** at the top of the file — not a class property:

```typescript
import { createLogger } from '@mma/telemetry';

const logger = createLogger('user-api-service');  // matches the Nx project name exactly
```

**Never** write `private readonly logger = new Logger(ClassName.name)`.

### Standard Log Levels

| Situation | Level | Method |
|---|---|---|
| Domain operation start/complete | Info | `logger.info(...)` |
| Unexpected but non-fatal | Warn | `logger.warn(...)` |
| Domain/business exception caught by filter | Warn | `logger.warn(...)` |
| Unhandled 5xx, infrastructure failure | Error | `logger.error(...)` |
| Fine-grained debugging (rarely committed) | Debug | `logger.debug(...)` |

### In Application Services

**Every method that modifies a database record or triggers a side effect MUST have before/after log lines.** This is enforced by the `app-service-has-logger` structural lint check in CI — any application service file missing `createLogger()` will fail the build.

Mutating operations include: create, update, delete, activate, deactivate, verify, state transitions, publishing events, generating presigned URLs, sign-in/sign-out, and password changes.

Log **before** the operation (what + key inputs) and **after** (confirming completion + result ID). Never log sensitive data (passwords, tokens, full PII, raw request bodies).

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';

const logger = createLogger('{domain}-api-service');

@Injectable()
export class {Domain}ApplicationService {
  async createSomething(input: CreateInput): Promise<SomethingDto> {
    logger.info('Creating something', { userId: input.userId, name: input.name });
    const entity = await this.createUseCase.execute(input);
    logger.info('Something created', { entityId: entity.id });
    return schema.parse(entity);
  }
}
```

### What Counts as a Mutating Operation

| Category | Examples | Before log required | After log required |
|---|---|---|---|
| CRUD writes | create, update, delete | Yes | Yes |
| State transitions | activate, deactivate, verify, confirm, ship, cancel | Yes | Yes |
| Auth operations | sign-in, sign-out, password change/reset, token refresh | Yes | Yes |
| Event publishing | SQS publish after use case | Yes (note event type) | — (publisher handles) |
| File operations | presigned upload URL generation | Yes | Yes |
| ACL calls (outbound) | cross-service HTTP validation (e.g. `customerValidator.validate()`) | Yes | Yes |
| Read endpoints called by ACL | getById when called by another service's ACL adapter | Yes | Yes |
| Read-only queries (internal) | getById, list, search called only by the owning service's controller | No | No |
```

### In Event Handler Dispatcher Services

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';

const logger = createLogger('{domain}-event-handler-service');

@Injectable()
export class {Domain}EventHandlerService {
  async handleRecords(records: NormalizedSqsRecord[]): Promise<void> {
    for (const record of records) {
      const parseResult = eventSchema.safeParse(JSON.parse(record.body));
      if (!parseResult.success) {
        logger.error('Invalid event shape — skipping', { messageId: record.messageId }, parseResult.error);
        return;
      }
      logger.info('Dispatching event', { eventType: parseResult.data.eventType, messageId: record.messageId });
      try {
        await this.dispatch(parseResult.data, record.messageId);
        logger.info('Event dispatched', { eventType: parseResult.data.eventType });
      } catch (error) {
        logger.error('Failed to dispatch event', { eventType: parseResult.data.eventType }, error);
        throw error; // Re-throw so SQS retries (and eventually routes to DLQ)
      }
    }
  }
}
```

### In Individual Event Handlers

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';

const logger = createLogger('{domain}-event-handler-service');

@Injectable()
export class {Entity}DeletedHandler {
  async handle(payload: {Entity}DeletedPayload, messageId?: string): Promise<void> {
    logger.info('Handling {ENTITY}_DELETED event', { entityId: payload.entityId, messageId: messageId ?? '(no id)' });
    await this.archiveUseCase.execute(payload);
    logger.info('{ENTITY}_DELETED handled', { entityId: payload.entityId });
  }
}
```

### In Exception Filters

```typescript
import { Catch, ExceptionFilter, ... } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';

const logger = createLogger('{domain}-api-service');

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // ... domain error map ...
    // Fallback 5xx:
    logger.error(`[${errorName}] ${message}`, {}, exception instanceof Error ? exception : undefined);
    response.status(500).json({ statusCode: 500, error: errorName, message });
  }
}
```

### In ACL Clients (`infrastructure/clients/`)

```typescript
import { createLogger } from '@mma/telemetry';

const logger = createLogger('{consuming-domain}-api-service');

export class {Upstream}ApiClient extends I{Upstream}Validator {
  async validate(id: string): Promise<ValidatedEntity> {
    try {
      const response = await fetch(url, { ... });
    } catch (error) {
      logger.error('Unexpected error calling {upstream} API', {}, error);
      throw new {Upstream}ServiceUnavailableError();
    }
    if (!response.ok) {
      logger.error('Upstream {upstream} API error', { status: response.status });
      throw new {Upstream}ServiceUnavailableError(...);
    }
  }
}
```

### Service Name Convention

| Service | Logger name |
|---|---|
| `user-api-service` | `'user-api-service'` |
| `product-api-service` | `'product-api-service'` |
| `order-api-service` | `'order-api-service'` |
| `auth-api-service` | `'auth-api-service'` |
| `file-api-service` | `'file-api-service'` |
| `monitoring-api-service` | `'monitoring-api-service'` |
| `user-event-handler-service` | `'user-event-handler-service'` |
| `product-event-handler-service` | `'product-event-handler-service'` |
| `order-event-handler-service` | `'order-event-handler-service'` |

### OTel Initialisation (`initTelemetry`)

Every service's `main.ts` must call `initTelemetry()` **before** `NestFactory.create()`:

```typescript
import { initTelemetry } from '@mma/telemetry';

initTelemetry('user-api-service');  // matches the logger name exactly

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ...
}
bootstrap();
```

`initTelemetry()` is a no-op when `OTEL_SDK_DISABLED=true` (set in `.env.local`). Locally, no OTel collector or X-Ray daemon is needed.

### Dependency

**HTTP API services** (no own `package.json`): `@mma/telemetry` resolves from the workspace root — no action needed.

**Event-handler services** (own `package.json`): add `"@mma/telemetry": "workspace:*"` to `dependencies`.

### SQS Queue URL Startup Validation

Event handler services must still validate their queue URL at startup:

```typescript
@Injectable()
export class {Domain}Module implements OnModuleInit {
  onModuleInit() {
    const queueUrl = process.env.{DOMAIN}_SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error(
        '[{DomainModule}] {DOMAIN}_SQS_QUEUE_URL is not set. ' +
        'Set it in .env.local (local) or service-registry.json envVars[] (deployed).'
      );
    }
  }
}
```

---

## Part 3 — CloudWatch Log Groups (Optional Custom Config)

Lambda log groups are created automatically by AWS. If you need custom retention or log metric filters, add them to the Lambda module by setting `log_retention_days` in the environment variable:

```hcl
module "api_services" {
  # ...
  log_retention_days = var.lambda_log_retention_days  # already wired
}
```

The `lambda_log_retention_days` variable defaults are set in each environment's `terraform.tfvars`:
- `dev`: 7 days
- `staging`: 14 days
- `prod`: 30 days
- `preview`: 3 days

No changes needed unless domain-specific retention is required.

---

## Checklist

- [ ] `lambda_functions` map updated in `dev/main.tf`, `staging/main.tf`, `prod/main.tf`, `preview/main.tf`
- [ ] `dlq_arns` map updated in all four environments (if new SQS queue added)
- [ ] Application service uses `const logger = createLogger('{service-name}')` at module level
- [ ] Every mutating method has before + after `logger.info(...)` calls (create, update, delete, state transitions, auth ops, file ops)
- [ ] `correlationMiddleware()` added as **first** middleware in `setupGlobalMiddleware()` (HTTP API services)
- [ ] ACL adapters (cross-service HTTP calls) spread `...getCorrelationHeaders()` into outbound request headers
- [ ] Event handler extracts `correlationId` from raw body and wraps processing in `runWithCorrelationId()` (event-driven services)
- [ ] Event schemas include `correlationId: z.string().optional()`
- [ ] Event handler service logs event type + messageId at the start of each handler
- [ ] Event handler service re-throws after logging so SQS retries and eventually routes to DLQ
- [ ] `onModuleInit()` validates queue URL env var on startup (event handler services)
- [ ] `DomainExceptionFilter` uses `createLogger()`, not `new Logger()`
