/**
 * RemoveOrderItem Use Case
 * Removes an item from a draft order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export interface RemoveOrderItemInput {
  orderId: string;
  itemId: string;
}

export class RemoveOrderItemUseCase implements IUseCase<RemoveOrderItemInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: RemoveOrderItemInput): Promise<Order> {
    if (!input.orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    if (!input.itemId) {
      throw new InvalidInputError('Item ID is required');
    }

    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    // Domain entity validates business rules (must be DRAFT)
    order.removeItem(input.itemId);

    return await this.orderRepository.save(order);
  }
}
