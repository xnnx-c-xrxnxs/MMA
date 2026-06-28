import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import { UpdateItemLatestPriceUseCase } from '@old-st/order-domain';
import type { ProductDomainEvent } from '@old-st/contracts/product';

const logger = createLogger('order-event-handler-service');

type ProductPriceChangedEvent = Extract<ProductDomainEvent, { eventType: 'PRODUCT_PRICE_CHANGED' }>;

/**
 * ProductPriceChangedHandler
 *
 * Updates latestKnownPrice on all DRAFT order items referencing the product.
 * This flags price drift — the order cannot be confirmed until the customer
 * reviews and acknowledges the new price.
 */
@Injectable()
export class ProductPriceChangedHandler implements IEventHandler<ProductPriceChangedEvent> {
  constructor(
    private readonly updateItemLatestPriceUseCase: UpdateItemLatestPriceUseCase,
  ) {}

  async handle(payload: ProductPriceChangedEvent, messageId?: string): Promise<void> {
    logger.info('Handling PRODUCT_PRICE_CHANGED event', { productId: payload.productId, oldPrice: payload.oldPrice, newPrice: payload.newPrice, messageId: messageId ?? '(no id)' });

    const result = await this.updateItemLatestPriceUseCase.execute({
      productId: payload.productId,
      newPrice: payload.newPrice,
    });

    logger.info('PRODUCT_PRICE_CHANGED handled — draft orders updated', { productId: payload.productId, updatedCount: result.updatedOrderIds.length });
  }
}
