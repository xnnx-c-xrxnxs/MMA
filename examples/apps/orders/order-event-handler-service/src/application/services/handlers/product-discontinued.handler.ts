import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import { CancelDraftOrdersByProductUseCase } from '@old-st/order-domain';
import type { ProductDomainEvent } from '@old-st/contracts/product';

const logger = createLogger('order-event-handler-service');

type ProductDiscontinuedEvent = Extract<ProductDomainEvent, { eventType: 'PRODUCT_DISCONTINUED' }>;

/**
 * ProductDiscontinuedHandler
 *
 * Cancels all DRAFT orders containing the discontinued product.
 */
@Injectable()
export class ProductDiscontinuedHandler implements IEventHandler<ProductDiscontinuedEvent> {
  constructor(
    private readonly cancelDraftOrdersUseCase: CancelDraftOrdersByProductUseCase,
  ) {}

  async handle(payload: ProductDiscontinuedEvent, messageId?: string): Promise<void> {
    logger.info('Handling PRODUCT_DISCONTINUED event', { productId: payload.productId, messageId: messageId ?? '(no id)' });

    const result = await this.cancelDraftOrdersUseCase.execute({
      productId: payload.productId,
    });

    logger.info('PRODUCT_DISCONTINUED handled — draft orders cancelled', { productId: payload.productId, cancelledCount: result.cancelledOrderIds.length });
  }
}
