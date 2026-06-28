// ─── OpenTelemetry SDK Bootstrapper ──────────────────────────────────────────
//
// Call initTelemetry(serviceName) as the FIRST line of every main.ts,
// before any other imports. This registers the SDK before NestJS loads modules
// so all auto-instrumentation hooks are in place.
//
// If OTEL_SDK_DISABLED=true (local dev, preview envs) this is a no-op.
// If OTEL_EXPORTER_OTLP_ENDPOINT is not set, traces are dropped silently.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { CompositePropagator } from '@opentelemetry/core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

let sdk: NodeSDK | null = null;

export function initTelemetry(serviceName: string): void {
  // Respect the kill-switch — local dev and preview environments set this
  if (process.env['OTEL_SDK_DISABLED'] === 'true') {
    return;
  }

  // Prevent duplicate registration (webpack can load this module multiple times)
  if (sdk !== null) {
    return;
  }

  const exporter = new OTLPTraceExporter({
    // When using the ADOT Lambda layer, this defaults to localhost:4318 automatically.
    // For local docker-compose setups, set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
      ? `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/traces`
      : undefined,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '1.0.0',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env['STAGE'] ?? 'local',
    }),
    traceExporter: exporter,
    // Support both W3C TraceContext (standard) and AWS X-Ray (for Lambda-to-Lambda links)
    // W3C is checked first — X-Ray format is used when the incoming context is from API GW
    textMapPropagator: new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new AWSXRayPropagator(),
      ],
    }),
    instrumentations: [
      // Auto-instruments all incoming/outgoing HTTP calls
      new HttpInstrumentation(),
      // Auto-instruments NestJS request lifecycle
      new NestInstrumentation(),
      // Auto-instruments DynamoDB, SQS, S3, Secrets Manager, and all other AWS SDK clients
      new AwsInstrumentation({
        suppressInternalInstrumentation: true,
      }),
      // Auto-instruments pg driver (PostgreSQL queries via Prisma)
      new PgInstrumentation({
        // Do not add SQL commenter comments to queries
        addSqlCommenterCommentToQueries: false,
      }),
    ],
  });

  try {
    sdk.start();
  } catch (err: unknown) {
    // Non-fatal — duplicate OTel API registration or SDK race condition.
    // The first registration wins and traces still propagate.
    console.error('[Telemetry] SDK start warning:', err instanceof Error ? err.message : err);
  }

  // Flush traces on Lambda shutdown signal
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .catch((err: unknown) => console.error('[Telemetry] Shutdown error:', err));
  });
}
