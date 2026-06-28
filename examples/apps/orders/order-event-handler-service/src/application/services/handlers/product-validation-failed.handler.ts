import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import type { ProductDomainEvent } from '@old-st/contracts/product';
import { FailOrderValidationUseCase } from '@old-st/order-domain';

const logger = createLogger('order-event-handler-service');

type ProductValidationFailedPayload = Extract<
  ProductDomainEvent,
  { eventType: 'PRODUCT_VALIDATION_FAILED' }
>;

/**
 * Handles PRODUCT_VALIDATION_FAILED events.
 * Transitions order DRAFT → VALIDATION_FAILED (terminal).
 *
 * Idempotent: if the order is already past DRAFT, logs and returns.
 */
@Injectable()
export class ProductValidationFailedHandler
  implements IEventHandler<ProductValidationFailedPayload>
{
  constructor(
    private readonly failOrderValidationUseCase: FailOrderValidationUseCase,
  ) {}

  async handle(
    payload: ProductValidationFailedPayload,
    messageId?: string,
  ): Promise<void> {
    logger.info('Handling PRODUCT_VALIDATION_FAILED event', { orderId: payload.orderId, reason: payload.reason, messageId: messageId ?? '(no id)' });

    try {
      await this.failOrderValidationUseCase.execute(payload.orderId);
      logger.info('Order transitioned to VALIDATION_FAILED', { orderId: payload.orderId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'CannotFailValidationError'
      ) {
        logger.warn('Order no longer DRAFT — saga already resolved, skipping', { orderId: payload.orderId });
        return;
      }
      throw error;
    }
  }
}
