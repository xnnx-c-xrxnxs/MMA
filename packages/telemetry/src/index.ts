export { initTelemetry } from './tracer';
export { createLogger } from './logger';
export type { StructuredLogger } from './logger';
export { injectTraceContext, extractTraceContext } from './sqs-propagation';
export type { SqsMessageAttributes } from './sqs-propagation';
export {
  runWithCorrelationId,
  runWithRequestContext,
  getCorrelationId,
  getAuthHeader,
  getCorrelationHeaders,
  getOutboundHeaders,
  correlationMiddleware,
} from './correlation';
export { context as otelContext } from '@opentelemetry/api';
