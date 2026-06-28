import { Injectable } from '@nestjs/common';
import { createLogger, extractTraceContext, otelContext, runWithCorrelationId } from '@old-st/telemetry';
import {
  orderDomainEventSchema,
  OrderEventTypeEnum,
} from '@old-st/contracts/order';

const logger = createLogger('product-event-handler-service');
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { OrderCreatedHandler } from './handlers';

@Injectable()
export class ProductEventHandlerService {
  constructor(
    private readonly orderCreatedHandler: OrderCreatedHandler,
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
    const parseResult = orderDomainEventSchema.safeParse(
      JSON.parse(record.body),
    );

    if (!parseResult.success) {
      logger.error('Invalid event shape from order domain — skipping', { messageId: record.messageId ?? '(no id)' }, parseResult.error);
      return;
    }

    const payload = parseResult.data;
    logger.info('Dispatching event from order domain', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });

    try {
      switch (payload.eventType) {
        case OrderEventTypeEnum.ORDER_CREATED:
          await this.orderCreatedHandler.handle(payload, record.messageId);
          break;

        default: {
          const unhandled = payload as unknown as { eventType: string };
          logger.warn('Unhandled order domain event', { eventType: unhandled.eventType, messageId: record.messageId ?? '(no id)' });
        }
      }

      logger.info('Event dispatched successfully', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });
    } catch (error) {
      logger.error('Failed to process event', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' }, error);
      throw error;
    }
  }
}
