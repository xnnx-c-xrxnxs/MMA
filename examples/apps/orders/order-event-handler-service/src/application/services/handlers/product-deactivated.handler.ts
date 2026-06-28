import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import { CancelDraftOrdersByProductUseCase } from '@old-st/order-domain';
import type { ProductDomainEvent } from '@old-st/contracts/product';

const logger = createLogger('order-event-handler-service');

type ProductDeactivatedEvent = Extract<ProductDomainEvent, { eventType: 'PRODUCT_DEACTIVATED' }>;

/**
 * ProductDeactivatedHandler
 *
 * Cancels all DRAFT orders containing the deactivated product.
 */
@Injectable()
export class ProductDeactivatedHandler implements IEventHandler<ProductDeactivatedEvent> {
  constructor(
    private readonly cancelDraftOrdersUseCase: CancelDraftOrdersByProductUseCase,
  ) {}

  async handle(payload: ProductDeactivatedEvent, messageId?: string): Promise<void> {
    logger.info('Handling PRODUCT_DEACTIVATED event', { productId: payload.productId, messageId: messageId ?? '(no id)' });

    const result = await this.cancelDraftOrdersUseCase.execute({
      productId: payload.productId,
    });

    logger.info('PRODUCT_DEACTIVATED handled — draft orders cancelled', { productId: payload.productId, cancelledCount: result.cancelledOrderIds.length });
  }
}
