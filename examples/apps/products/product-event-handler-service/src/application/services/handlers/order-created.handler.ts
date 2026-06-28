import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import type { OrderDomainEvent } from '@old-st/contracts/order';
import { ProductEventTypeEnum } from '@old-st/contracts/product';
import { CheckProductsAvailabilityUseCase } from '@old-st/product-domain';
import type { IEventPublisher } from '@old-st/common';

const logger = createLogger('product-event-handler-service');

// Narrow the discriminated union to the specific event variant
type OrderCreatedPayload = Extract<
  OrderDomainEvent,
  { eventType: 'ORDER_CREATED' }
>;

/**
 * Handles ORDER_CREATED events from the order bounded context.
 *
 * Validates each product in the order: exists, ACTIVE, price matches.
 * Publishes PRODUCT_VALIDATION_SUCCEEDED or PRODUCT_VALIDATION_FAILED
 * back to the order-events queue.
 */
@Injectable()
export class OrderCreatedHandler
  implements IEventHandler<OrderCreatedPayload>
{
  constructor(
    private readonly checkProductsAvailabilityUseCase: CheckProductsAvailabilityUseCase,
    @Inject('VALIDATION_RESULT_PUBLISHER')
    private readonly resultPublisher: IEventPublisher<unknown>,
  ) {}

  async handle(
    payload: OrderCreatedPayload,
    messageId?: string,
  ): Promise<void> {
    logger.info('Handling ORDER_CREATED event', { orderId: payload.orderId, itemCount: payload.items.length, messageId: messageId ?? '(no id)' });

    const productIds = payload.items.map((i) => i.productId);
    const failedProducts: Array<{ productId: string; issue: string }> = [];

    try {
      const products =
        await this.checkProductsAvailabilityUseCase.execute({ productIds });

      // Build a map for quick lookup
      const productMap = new Map(
        products.map((p) => [p.getProductId(), p]),
      );

      for (const item of payload.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          failedProducts.push({
            productId: item.productId,
            issue: 'Product not found',
          });
          continue;
        }

        if (!product.isActive()) {
          failedProducts.push({
            productId: item.productId,
            issue: `Product is not active (status: ${product.getStatus()})`,
          });
          continue;
        }

        if (product.getPrice() !== item.price) {
          failedProducts.push({
            productId: item.productId,
            issue: `Price mismatch: expected ${item.price}, actual ${product.getPrice()}`,
          });
        }
      }
    } catch (error) {
      logger.error('Error checking product availability', { orderId: payload.orderId }, error);
      failedProducts.push({
        productId: 'unknown',
        issue: `Product availability check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    if (failedProducts.length === 0) {
      await this.resultPublisher.publish({
        eventType: ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED,
        orderId: payload.orderId,
        occurredAt: new Date().toISOString(),
      }, { groupId: payload.orderId });
      logger.info('Product validation SUCCEEDED', { orderId: payload.orderId });
    } else {
      await this.resultPublisher.publish({
        eventType: ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED,
        orderId: payload.orderId,
        reason: `${failedProducts.length} product(s) failed validation`,
        failedProducts,
        occurredAt: new Date().toISOString(),
      }, { groupId: payload.orderId });
      logger.warn('Product validation FAILED', { orderId: payload.orderId, failedCount: failedProducts.length, failedProducts });
    }
  }
}
