/**
 * UpdateItemLatestPrice Use Case
 *
 * Finds all DRAFT orders containing a specific product and updates the
 * latestKnownPrice on matching items. This flags price drift without
 * modifying the original snapshot price.
 *
 * Used by event handlers when a product's price changes.
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderStatusEnum } from '../../../domain/constants';

export interface UpdateItemLatestPriceInput {
  productId: string;
  newPrice: number;
}

export interface UpdateItemLatestPriceOutput {
  updatedOrderIds: string[];
}

export class UpdateItemLatestPriceUseCase
  implements IUseCase<UpdateItemLatestPriceInput, UpdateItemLatestPriceOutput>
{
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(
    input: UpdateItemLatestPriceInput,
  ): Promise<UpdateItemLatestPriceOutput> {
    const updatedOrderIds: string[] = [];

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
        // Only update DRAFT orders — confirmed+ orders have frozen prices
        if (order.getOrderStatus() !== OrderStatusEnum.DRAFT) {
          continue;
        }

        let modified = false;
        for (const item of order.getItems()) {
          if (item.getProductId() === input.productId) {
            item.updateLatestKnownPrice(input.newPrice);
            modified = true;
          }
        }

        if (modified) {
          await this.orderRepository.save(order);
          const orderId = order.getOrderId();
          if (orderId) {
            updatedOrderIds.push(orderId);
          }
        }
      }

      hasMore = currentPage < result.totalPages;
      currentPage++;
    }

    return { updatedOrderIds };
  }
}
