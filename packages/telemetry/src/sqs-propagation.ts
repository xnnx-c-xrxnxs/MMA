// ─── SQS Trace Propagation ────────────────────────────────────────────────────
//
// Injects and extracts W3C TraceContext (`traceparent`) headers into SQS
// MessageAttributes so a trace started in an HTTP API service continues
// through SQS into the consumer Lambda.
//
// Inject at publish time:
//   const traceAttrs = injectTraceContext();
//   // merge traceAttrs into your SendMessageCommand.MessageAttributes
//
// Extract at consume time:
//   activateTraceContext(record.messageAttributes);
//   // subsequent OTel spans are automatically linked to the upstream trace

import {
  context as otelContext,
  propagation,
  trace,
  ROOT_CONTEXT,
} from '@opentelemetry/api';

export type SqsMessageAttributes = Record<
  string,
  { DataType: string; StringValue?: string }
>;

// ─── Inject (publisher side) ─────────────────────────────────────────────────

/**
 * Serialises the active trace context into SQS MessageAttributes.
 * Returns an object you spread into SendMessageCommand.MessageAttributes.
 *
 * Returns an empty object when there is no active trace (OTEL_SDK_DISABLED or local).
 *
 * Example:
 *   const command = new SendMessageCommand({
 *     QueueUrl: queueUrl,
 *     MessageBody: JSON.stringify(event),
 *     MessageAttributes: {
 *       ...injectTraceContext(),
 *     },
 *   });
 */
export function injectTraceContext(): SqsMessageAttributes {
  const carrier: Record<string, string> = {};
  propagation.inject(otelContext.active(), carrier);

  // Convert flat string carrier → SQS MessageAttribute format
  return Object.fromEntries(
    Object.entries(carrier).map(([key, value]) => [
      key,
      { DataType: 'String', StringValue: value },
    ]),
  );
}

// ─── Extract (consumer side) ─────────────────────────────────────────────────

/**
 * Extracts trace context from SQS MessageAttributes and returns an
 * activated OTel context. Wrap your handler body with this to continue
 * the upstream trace.
 *
 * Example:
 *   const ctx = extractTraceContext(record.MessageAttributes ?? {});
 *   otelContext.with(ctx, () => {
 *     // your handler logic — spans created here link to the upstream trace
 *   });
 */
export function extractTraceContext(
  messageAttributes: SqsMessageAttributes,
): ReturnType<typeof otelContext.active> {
  // Convert SQS MessageAttribute format → flat string carrier
  const carrier: Record<string, string> = {};
  for (const [key, attr] of Object.entries(messageAttributes)) {
    if (attr.DataType === 'String' && attr.StringValue) {
      carrier[key] = attr.StringValue;
    }
  }

  return propagation.extract(ROOT_CONTEXT, carrier);
}
