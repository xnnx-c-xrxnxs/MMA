/**
 * CancelDraftOrdersByProduct Use Case
 *
 * Finds all DRAFT orders containing a specific product and cancels them.
 * Used by event handlers when a product is deactivated, discontinued, or deleted.
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderStatusEnum } from '../../../domain/constants';

export interface CancelDraftOrdersByProductInput {
  productId: string;
}

export interface CancelDraftOrdersByProductOutput {
  cancelledOrderIds: string[];
}

export class CancelDraftOrdersByProductUseCase
  implements IUseCase<CancelDraftOrdersByProductInput, CancelDraftOrdersByProductOutput>
{
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(
    input: CancelDraftOrdersByProductInput,
  ): Promise<CancelDraftOrdersByProductOutput> {
    const cancelledOrderIds: string[] = [];

    // Page through all orders containing this product
    let currentPage = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const result = await this.orderRepository.findByProductId(
        input.productId,
        currentPage,
        pageSize,
      );

      for (const order of result.data) {
        if (order.getOrderStatus() === OrderStatusEnum.DRAFT) {
          order.cancel();
          await this.orderRepository.save(order);
          const orderId = order.getOrderId();
          if (orderId) {
            cancelledOrderIds.push(orderId);
          }
        }
      }

      hasMore = currentPage < result.totalPages;
      currentPage++;
    }

    return { cancelledOrderIds };
  }
}
