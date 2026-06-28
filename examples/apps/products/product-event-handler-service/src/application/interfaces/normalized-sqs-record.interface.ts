/**
 * Normalized SQS record — shared interface for both local polling and Lambda execution paths.
 */
export interface NormalizedSqsRecord {
  /** The raw message body string. Parsed to JSON inside the event handler service. */
  body: string;
  /** SQS message ID — useful for logging and deduplication. */
  messageId?: string;
  /** SQS receipt handle — used by SqsLocalService to delete the message after processing. */
  receiptHandle?: string;
  /**
   * SQS message attributes — carries OTel trace context (`traceparent`) injected by the publisher.
   * Used by extractTraceContext() to continue the upstream distributed trace.
   */
  messageAttributes?: Record<string, { DataType: string; StringValue?: string }>;
}
