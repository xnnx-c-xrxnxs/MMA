/**
 * Normalized SQS record — shared interface for both local polling and Lambda execution paths.
 *
 * Local path:  SqsLocalService maps AWS SDK `Message` (capital `Body`, `MessageId`, `ReceiptHandle`)
 *              → NormalizedSqsRecord before calling handleRecords().
 *
 * Lambda path: main.ts handler maps `SQSRecord` from @types/aws-lambda (lowercase `body`,
 *              `messageId`, `receiptHandle`) → NormalizedSqsRecord before calling handleRecords().
 *
 * The application service depends on this interface only — never on AWS SDK or Lambda types.
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
   * The Lambda handler and SqsLocalService both populate this field.
   * Used by extractTraceContext() to continue the upstream distributed trace.
   */
  messageAttributes?: Record<string, { DataType: string; StringValue?: string }>;
}
