// ─── Structured JSON Logger ───────────────────────────────────────────────────
//
// Emits JSON to stdout. Lambda auto-ships stdout to CloudWatch Logs.
// Every log line includes the active OTel trace ID and span ID so logs
// can be correlated with X-Ray traces in CloudWatch Log Insights.
//
// Usage:
//   const logger = createLogger('user-api-service');
//   logger.info('User created', { userId: 'usr_123' });
//
// Log Insights query to find errors across all services:
//   fields @timestamp, level, service, message, traceId
//   | filter level = "ERROR"
//   | sort @timestamp desc

import { trace, context as otelContext } from '@opentelemetry/api';
import { getCorrelationId } from './correlation';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

export interface StructuredLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields, error?: unknown): void;
}

function getTraceContext(): { traceId?: string; spanId?: string; correlationId?: string } {
  const span = trace.getActiveSpan();
  const correlationId = getCorrelationId();

  const result: { traceId?: string; spanId?: string; correlationId?: string } = {};

  if (span) {
    const ctx = span.spanContext();
    const isValidTrace = ctx.traceId !== '00000000000000000000000000000000';
    if (isValidTrace) {
      result.traceId = ctx.traceId;
      result.spanId = ctx.spanId;
    }
  }

  if (correlationId) {
    result.correlationId = correlationId;
  }

  return result;
}

function emit(service: string, level: LogLevel, message: string, fields?: LogFields, error?: unknown): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service,
    message,
    ...getTraceContext(),
    ...fields,
  };

  if (error !== undefined) {
    if (error instanceof Error) {
      entry['errorType'] = error.constructor.name;
      entry['errorMessage'] = error.message;
      entry['stack'] = error.stack;
    } else {
      entry['errorRaw'] = String(error);
    }
  }

  // Use process.stdout.write to avoid NestJS Logger intercepting the output
  // JSON.stringify never throws for plain objects
  process.stdout.write(JSON.stringify(entry) + '\n');

  // Double-log errors to stderr so they appear in CloudWatch even if
  // NestJS Logger suppresses stdout in certain configurations
  if (level === 'error') {
    console.error('[ERROR]', message, error ?? '');
  }
}

export function createLogger(serviceName: string): StructuredLogger {
  return {
    debug: (message, fields) => emit(serviceName, 'debug', message, fields),
    info: (message, fields) => emit(serviceName, 'info', message, fields),
    warn: (message, fields) => emit(serviceName, 'warn', message, fields),
    error: (message, fields, error) => emit(serviceName, 'error', message, fields, error),
  };
}
