---
name: xray-adot-setup
description: Configure or troubleshoot AWS X-Ray distributed tracing for backend Lambdas. Use this when adding X-Ray to a new service, debugging missing trace segments, or wiring custom subsegments around outbound calls (database, cross-service HTTP, SQS publish).
---

# X-Ray Tracing Setup

Backend services in this template emit OpenTelemetry spans via the `@mma/telemetry` package. In **deployed** environments, the spans flow to **AWS X-Ray** (no separate ADOT layer required — the OTel SDK exports directly via the X-Ray exporter).

This skill covers:
- Verifying tracing is enabled on a Lambda
- Adding custom subsegments around hot paths
- Debugging missing traces
- Wiring X-Ray for a brand-new service

Canonical references:
- `packages/telemetry/src/tracer.ts` — `initTelemetry(serviceName)` bootstrap
- `packages/telemetry/src/sqs-propagation.ts` — trace context for SQS messages
- `apps/monitoring/monitoring-api-service/src/application/services/traces.service.ts` — how the monitoring tool reads X-Ray segments
- `docs/monitoring.md` — broader observability architecture

---

## Part 1 — Confirm the Service Is Wired

In the service's `main.ts`:

```ts
import { initTelemetry } from '@mma/telemetry';

initTelemetry('my-api-service');   // MUST be called BEFORE NestFactory.create()

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ...
}
```

If this call is missing or runs after `NestFactory.create`, no spans will be exported. The lint check `service-uses-init-telemetry` (in `scripts/lint-standards.ts`) catches this.

---

## Part 2 — Confirm Lambda Has X-Ray Enabled

Every Lambda function in this template has X-Ray enabled by default via the `infra/modules/lambda-api/` and `lambda-worker/` modules:

```hcl
resource "aws_lambda_function" "this" {
  # ... other config ...

  tracing_config {
    mode = "Active"
  }
}
```

If you create a Lambda outside these modules (rare), add this block. Without it, the OTel exporter has nothing to write to.

---

## Part 3 — Confirm IAM Permission

The Lambda execution role must include the AWS-managed policy `AWSXRayDaemonWriteAccess` or its inline equivalent:

```hcl
statement {
  effect = "Allow"
  actions = [
    "xray:PutTraceSegments",
    "xray:PutTelemetryRecords",
  ]
  resources = ["*"]
}
```

This is already attached by `infra/modules/lambda-api/iam.tf` and `lambda-worker/iam.tf`. New custom Lambda definitions must include it.

---

## Part 4 — Add Custom Subsegments

The OTel SDK auto-instruments common libraries (HTTP clients, DynamoDB SDK, Postgres, SQS). For domain-level subsegments (e.g. "process order", "validate inventory"), wrap the hot path manually:

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-application-service');

async createOrder(input: CreateOrderInput) {
  return tracer.startActiveSpan('createOrder', async (span) => {
    try {
      span.setAttribute('orderId', input.orderId);
      span.setAttribute('customerId', input.customerId);
      span.setAttribute('itemCount', input.items.length);

      const result = await this.useCase.execute(input);

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

The subsegment appears nested under the auto-generated request span in the X-Ray console.

> **Tip:** Set domain identifiers (orderId, customerId, status) as span attributes — they become searchable in X-Ray.

---

## Part 5 — SQS Trace Propagation

X-Ray does not auto-propagate trace context across SQS messages — the OTel SDK does, via `MessageAttributes`.

The `@mma/telemetry` package handles this automatically when you use the SQS publishers in `@mma/aws-sqs`:

```ts
// Publisher (HTTP service)
import { SqsFifoEventPublisher } from '@mma/aws-sqs';

await this.publisher.publish('user-events', userCreatedEvent, { groupId: userId });
// ↑ SqsFifoEventPublisher internally calls injectTraceContext()
//   which writes traceparent + tracestate as MessageAttributes
```

```ts
// Consumer (event-handler service)
import { extractTraceContext, runWithCorrelationId } from '@mma/telemetry';

async handle(record: SQSRecord) {
  const ctx = extractTraceContext(record.messageAttributes);
  // ↑ This reconstructs the trace context so the span continues
  //    the publisher's trace instead of starting a new one.

  await runWithCorrelationId(record.body.correlationId, async () => {
    return context.with(ctx, () => this.dispatch(record));
  });
}
```

If a brand-new consumer service skips `extractTraceContext`, X-Ray shows two disconnected traces (publish + consume) instead of one continuous flow.

---

## Part 6 — Debugging "No Traces in X-Ray"

| Symptom | Likely cause | Fix |
|---|---|---|
| Lambda returns successfully, no trace appears | `initTelemetry()` not called or called after `NestFactory.create()` | Move it to top of `main.ts` |
| Lambda returns successfully, trace shows only the auto-Lambda segment | OTel SDK initialised but exporter failing silently | Check Lambda CloudWatch Logs for `OTLP exporter error` |
| Trace appears but missing custom subsegments | `tracer.startActiveSpan` not called, or span never `.end()`'d | Verify try/finally pattern from Part 4 |
| Cross-service HTTP calls show as disconnected traces | OTel HTTP instrumentation not active OR target service missing `initTelemetry` | Confirm both services have `initTelemetry` and the SDK's `instrumentations` array includes `@opentelemetry/instrumentation-http` |
| SQS consumer trace disconnected from producer | `extractTraceContext` not called in handler | Add the call as shown in Part 5 |
| `OTEL_SDK_DISABLED=true` set accidentally in deployed env | Local-only flag leaked to production | Remove from `service-registry.json envVars` and from deployed Lambda config |

---

## Part 7 — Local Behaviour

Locally (`STAGE=local`), `initTelemetry()` is a **no-op** when `OTEL_SDK_DISABLED=true` (set by `.env.local.example`). This is intentional — there is no local X-Ray endpoint, and console exporters add noise.

To temporarily enable local trace export to a console exporter for debugging:

```sh
# Run a single service with traces dumped to stdout
STAGE=local OTEL_SDK_DISABLED=false OTEL_TRACES_EXPORTER=console pnpm nx serve user-api-service
```

---

## Part 8 — X-Ray Sampling

Default sampling is **1 request per second + 5% of additional**. To increase fidelity for a low-traffic environment:

1. Create a sampling rule in the AWS X-Ray console (or via Terraform `aws_xray_sampling_rule`).
2. Set `FixedRate = 1.0` (sample 100%) for your service's resource ARN pattern.
3. Apply only in dev / staging — production usually keeps the default to control cost.

---

## Output Checklist

- [ ] `initTelemetry('{service}')` is the first line in `main.ts`
- [ ] Lambda function has `tracing_config { mode = "Active" }`
- [ ] Lambda IAM role allows `xray:PutTraceSegments` + `xray:PutTelemetryRecords`
- [ ] Custom subsegments wrap hot paths with try/finally + `span.end()`
- [ ] SQS consumers call `extractTraceContext` before dispatching
- [ ] Domain identifiers set as span attributes (searchable in X-Ray)
- [ ] Verified end-to-end trace appears in X-Ray console after a real request
