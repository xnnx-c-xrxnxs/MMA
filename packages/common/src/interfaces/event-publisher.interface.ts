/**
 * EventPublishOptions
 *
 * Platform-agnostic publish options. Each concrete publisher maps these to
 * its own protocol-specific fields:
 *
 *   groupId          → SQS: MessageGroupId (required for FIFO — the default queue type)
 *                    → Kafka: partition key
 *                    → Azure Service Bus: session ID
 *
 *   deduplicationId  → SQS FIFO: MessageDeduplicationId
 *                      (omit to fall back to content-based deduplication via SHA-256 hash)
 *
 *   delaySeconds     → SQS Standard: DelaySeconds (0–900)
 *                      NOT applicable to FIFO queues (the default) — this field is ignored
 *                      by FIFO publishers. Only use with explicit Standard opt-out queues.
 */
export interface EventPublishOptions {
  /**
   * Logical group / partition key.
   *
   * **Required by default** — FIFO is the default queue type in this codebase.
   * Use the root entity ID as the groupId (e.g. `userId`, `orderId`, `productId`)
   * to ensure all events for the same entity are processed in order.
   *
   * Optional only for explicit Standard queue opt-out. On Standard queues,
   * providing a groupId enables fair-queue routing behaviour.
   */
  groupId?: string;

  /**
   * Deduplication token.
   * Only meaningful for FIFO queues. If omitted, the publisher falls back to
   * a SHA-256 hash of the serialized event body (content-based deduplication).
   */
  deduplicationId?: string;

  /**
   * Delay in seconds before the message becomes visible to consumers (0–900).
   * Only applicable to Standard queues (explicit opt-out). NOT supported on
   * FIFO queues (the default) — silently ignored by FIFO publishers.
   * Do not pass this option when publishing to the default FIFO queue type.
   */
  delaySeconds?: number;
}

/**
 * IEventPublisher<T>
 *
 * Generic contract for all event publishers across the platform.
 *
 * T — the event payload type (serialized as JSON internally)
 *
 * Benefits:
 * - Application services depend only on this interface, never on AWS SDK types
 * - Swapping SQS → Kafka → Azure Service Bus requires changing only the module
 *   wiring (useFactory), not any application service code
 * - Uniform mock shape in tests: { publish: jest.fn() }
 *
 * Concrete implementations live in platform packages:
 *   @old-st/aws-sqs → SqsStandardEventPublisher, SqsFifoEventPublisher
 */
export interface IEventPublisher<T> {
  publish(event: T, options?: EventPublishOptions): Promise<void>;
}
