import { Injectable } from '@nestjs/common';
import { createLogger, extractTraceContext, otelContext, runWithCorrelationId } from '@old-st/telemetry';
import { userDomainEventSchema, UserEventTypeEnum } from '@old-st/contracts/user';

const logger = createLogger('user-event-handler-service');
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { UserDeletedHandler } from './handlers';

/**
 * UserEventHandlerService
 *
 * Thin dispatcher — parses the SQS message body, validates the event shape
 * against the Zod discriminated union, and routes each event to its dedicated
 * per-event handler.
 *
 * Rules:
 *   - Zero event logic in this file — every `case` is a single handler.handle() call.
 *   - safeParse (not parse) — invalid bodies are logged and skipped.
 *   - Handler errors are rethrown so SqsLocalService skips DeleteMessageCommand.
 *   - Adding a new event: create a handler → add to handlers/index.ts → add one case here.
 */
@Injectable()
export class UserEventHandlerService {
  constructor(
    private readonly userDeletedHandler: UserDeletedHandler,
  ) {}

  /**
   * Entry point for both local SQS polling and Lambda execution.
   * Processes each record independently — a failure on one record does not abort the batch.
   */
  async handleRecords(records: NormalizedSqsRecord[]): Promise<void> {
    for (const record of records) {
      const ctx = extractTraceContext(record.messageAttributes ?? {});
      // Extract correlationId from event body to propagate through the handler chain
      let correlationId: string | undefined;
      try {
        const raw = JSON.parse(record.body);
        correlationId = typeof raw.correlationId === 'string' ? raw.correlationId : undefined;
      } catch { /* body parse handled in processRecord */ }

      const process = () => this.processRecord(record);
      await otelContext.with(ctx, () =>
        correlationId ? runWithCorrelationId(correlationId, process) : process()
      );
    }
  }

  private async processRecord(record: NormalizedSqsRecord): Promise<void> {
    const parseResult = userDomainEventSchema.safeParse(
      JSON.parse(record.body),
    );

    if (!parseResult.success) {
      logger.error('Invalid event shape — skipping message', { messageId: record.messageId ?? '(no id)' }, parseResult.error);
      return;
    }

    const payload = parseResult.data;
    logger.info('Dispatching event', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });

    try {
      switch (payload.eventType) {
        case UserEventTypeEnum.USER_DELETED:
          await this.userDeletedHandler.handle(payload, record.messageId);
          break;

        // Exhaustiveness guard — when a new event type is added to USER_EVENTS,
        // add a handler file, add it to handlers/index.ts, and add a case above.
        // The Zod discriminated union will reject unregistered event types before they reach here.
        default: {
          const unhandledEvent = payload as unknown as { eventType: string };
          logger.warn('Unhandled event type', { eventType: unhandledEvent.eventType, messageId: record.messageId ?? '(no id)' });
        }
      }

      logger.info('Event dispatched successfully', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });
    } catch (error) {
      logger.error('Failed to dispatch event', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' }, error);
      throw error;
    }
  }
}
