import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import { CancelDraftOrdersByProductUseCase } from '@old-st/order-domain';
import type { ProductDomainEvent } from '@old-st/contracts/product';

const logger = createLogger('order-event-handler-service');

type ProductDeletedEvent = Extract<ProductDomainEvent, { eventType: 'PRODUCT_DELETED' }>;

/**
 * ProductDeletedHandler
 *
 * Cancels all DRAFT orders containing the deleted product.
 */
@Injectable()
export class ProductDeletedHandler implements IEventHandler<ProductDeletedEvent> {
  constructor(
    private readonly cancelDraftOrdersUseCase: CancelDraftOrdersByProductUseCase,
  ) {}

  async handle(payload: ProductDeletedEvent, messageId?: string): Promise<void> {
    logger.info('Handling PRODUCT_DELETED event', { productId: payload.productId, messageId: messageId ?? '(no id)' });

    const result = await this.cancelDraftOrdersUseCase.execute({
      productId: payload.productId,
    });

    logger.info('PRODUCT_DELETED handled — draft orders cancelled', { productId: payload.productId, cancelledCount: result.cancelledOrderIds.length });
  }
}
