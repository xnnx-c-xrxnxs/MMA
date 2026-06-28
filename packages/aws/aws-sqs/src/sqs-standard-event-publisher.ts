import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IEventPublisher, EventPublishOptions } from '@mma/common';
import { injectTraceContext, getCorrelationId } from '@mma/telemetry';

/**
 * SqsStandardEventPublisher<T>
 *
 * Publishes events to a standard (non-FIFO) SQS queue.
 *
 * Queue URL is bound at construction time — never passed per-call.
 * This mirrors the repository pattern: the repository receives its table at
 * construction, not per-method.
 *
 * options.groupId    → MessageGroupId (optional — enables fair-queue / tenant isolation)
 * options.delaySeconds → DelaySeconds (0–900s, optional)
 * options.deduplicationId → ignored (not applicable to standard queues)
 *
 * Usage in NestJS module (useFactory):
 *   const client = STAGE === 'local' ? createLocalSqsClient() : createAwsSqsClient();
 *   return new SqsStandardEventPublisher(client, process.env.MY_SQS_QUEUE_URL);
 */
export class SqsStandardEventPublisher<T> implements IEventPublisher<T> {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async publish(event: T, options?: EventPublishOptions): Promise<void> {
    // Auto-inject correlationId from the request context into the event body
    const correlationId = getCorrelationId();
    const body = correlationId
      ? { ...(event as Record<string, unknown>), correlationId }
      : event;

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(body),
      // Inject W3C trace context so the consumer Lambda continues the same trace
      MessageAttributes: injectTraceContext(),
      ...(options?.groupId !== undefined && { MessageGroupId: options.groupId }),
      ...(options?.delaySeconds !== undefined && { DelaySeconds: options.delaySeconds }),
    });

    await this.sqsClient.send(command);
  }
}
