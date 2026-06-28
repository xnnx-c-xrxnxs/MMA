import { createHash } from 'crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IEventPublisher, EventPublishOptions } from '@old-st/common';
import { injectTraceContext, getCorrelationId } from '@old-st/telemetry';

/**
 * SqsFifoEventPublisher<T>
 *
 * Publishes events to a FIFO SQS queue (queue name must end in `.fifo`).
 *
 * Queue URL is bound at construction time — never passed per-call.
 *
 * FIFO-specific behaviour:
 *   options.groupId         → MessageGroupId — REQUIRED. Throws if missing.
 *   options.deduplicationId → MessageDeduplicationId — optional.
 *                             If omitted, falls back to SHA-256 hash of the
 *                             serialized body (content-based deduplication).
 *   options.delaySeconds    → IGNORED. FIFO queues do not support per-message
 *                             delay (only queue-level delay is supported).
 *
 * To enable content-based deduplication as the default (no deduplicationId
 * required per publish), set ContentBasedDeduplication=true on the queue
 * in scripts/setup-localstack.ts (fifo: true already does this).
 *
 * Usage in NestJS module (useFactory):
 *   const client = STAGE === 'local' ? createLocalSqsClient() : createAwsSqsClient();
 *   return new SqsFifoEventPublisher(client, process.env.MY_FIFO_SQS_QUEUE_URL);
 */
export class SqsFifoEventPublisher<T> implements IEventPublisher<T> {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async publish(event: T, options?: EventPublishOptions): Promise<void> {
    if (!options?.groupId) {
      throw new Error(
        'SqsFifoEventPublisher: options.groupId (MessageGroupId) is required for FIFO queues.',
      );
    }

    // Auto-inject correlationId from the request context into the event body
    const correlationId = getCorrelationId();
    const enrichedEvent = correlationId
      ? { ...(event as Record<string, unknown>), correlationId }
      : event;

    const body = JSON.stringify(enrichedEvent);

    // Fall back to SHA-256 hash of the body when no explicit deduplication ID is provided.
    // This mirrors the ContentBasedDeduplication behaviour AWS applies server-side
    // when that attribute is enabled on the queue.
    const deduplicationId =
      options.deduplicationId ?? createHash('sha256').update(body).digest('hex');

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: body,
      MessageGroupId: options.groupId,
      MessageDeduplicationId: deduplicationId,
      // Inject W3C trace context so the consumer Lambda continues the same trace
      MessageAttributes: injectTraceContext(),
      // DelaySeconds intentionally omitted — not supported per-message on FIFO queues.
    });

    await this.sqsClient.send(command);
  }
}
