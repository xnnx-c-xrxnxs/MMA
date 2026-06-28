import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import type { ProductDomainEvent } from '@old-st/contracts/product';
import { ApproveProductValidationUseCase } from '@old-st/order-domain';

const logger = createLogger('order-event-handler-service');

type ProductValidationSucceededPayload = Extract<
  ProductDomainEvent,
  { eventType: 'PRODUCT_VALIDATION_SUCCEEDED' }
>;

/**
 * Handles PRODUCT_VALIDATION_SUCCEEDED events.
 * Transitions order DRAFT → PENDING (products validated, awaiting payment).
 *
 * Idempotent: if the order is already past DRAFT, logs and returns.
 */
@Injectable()
export class ProductValidationSucceededHandler
  implements IEventHandler<ProductValidationSucceededPayload>
{
  constructor(
    private readonly approveProductValidationUseCase: ApproveProductValidationUseCase,
  ) {}

  async handle(
    payload: ProductValidationSucceededPayload,
    messageId?: string,
  ): Promise<void> {
    logger.info('Handling PRODUCT_VALIDATION_SUCCEEDED event', { orderId: payload.orderId, messageId: messageId ?? '(no id)' });

    try {
      await this.approveProductValidationUseCase.execute(payload.orderId);
      logger.info('Order transitioned to PENDING', { orderId: payload.orderId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'CannotApproveProductValidationError'
      ) {
        logger.warn('Order no longer DRAFT — saga already resolved, skipping', { orderId: payload.orderId });
        return;
      }
      throw error;
    }
  }
}
