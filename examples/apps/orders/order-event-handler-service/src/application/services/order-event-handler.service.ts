import { Injectable } from '@nestjs/common';
import { createLogger, extractTraceContext, otelContext, runWithCorrelationId } from '@old-st/telemetry';
import { productDomainEventSchema, ProductEventTypeEnum } from '@old-st/contracts/product';

const logger = createLogger('order-event-handler-service');
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import {
  ProductDeactivatedHandler,
  ProductDiscontinuedHandler,
  ProductDeletedHandler,
  ProductPriceChangedHandler,
  ProductValidationSucceededHandler,
  ProductValidationFailedHandler,
} from './handlers';

/**
 * OrderEventHandlerService
 *
 * Thin dispatcher — parses the SQS message body, validates the event shape
 * against the product domain's Zod discriminated union, and routes each event
 * to its dedicated per-event handler.
 *
 * This is a CROSS-DOMAIN consumer: it imports event schemas from
 * @old-st/contracts/product (Published Language) — never from @old-st/product-domain.
 *
 * Rules:
 *   - Zero event logic in this file — every `case` is a single handler.handle() call.
 *   - safeParse (not parse) — invalid bodies are logged and skipped.
 *   - Handler errors are rethrown so SqsLocalService skips DeleteMessageCommand.
 *   - Adding a new event: create a handler → add to handlers/index.ts → add one case here.
 */
@Injectable()
export class OrderEventHandlerService {
  constructor(
    private readonly productDeactivatedHandler: ProductDeactivatedHandler,
    private readonly productDiscontinuedHandler: ProductDiscontinuedHandler,
    private readonly productDeletedHandler: ProductDeletedHandler,
    private readonly productPriceChangedHandler: ProductPriceChangedHandler,
    private readonly productValidationSucceededHandler: ProductValidationSucceededHandler,
    private readonly productValidationFailedHandler: ProductValidationFailedHandler,
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
    const parseResult = productDomainEventSchema.safeParse(
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
        case ProductEventTypeEnum.PRODUCT_DEACTIVATED:
          await this.productDeactivatedHandler.handle(payload, record.messageId);
          break;

        case ProductEventTypeEnum.PRODUCT_DISCONTINUED:
          await this.productDiscontinuedHandler.handle(payload, record.messageId);
          break;

        case ProductEventTypeEnum.PRODUCT_DELETED:
          await this.productDeletedHandler.handle(payload, record.messageId);
          break;

        case ProductEventTypeEnum.PRODUCT_PRICE_CHANGED:
          await this.productPriceChangedHandler.handle(payload, record.messageId);
          break;

        case ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED:
          await this.productValidationSucceededHandler.handle(payload, record.messageId);
          break;

        case ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED:
          await this.productValidationFailedHandler.handle(payload, record.messageId);
          break;

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
