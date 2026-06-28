/**
 * UpdateOrderItemQuantity Use Case
 * Updates the quantity of an item in a draft order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export interface UpdateOrderItemQuantityInput {
  orderId: string;
  itemId: string;
  quantity: number;
}

export class UpdateOrderItemQuantityUseCase implements IUseCase<UpdateOrderItemQuantityInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: UpdateOrderItemQuantityInput): Promise<Order> {
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

    // Domain entity validates business rules (must be DRAFT, item must exist)
    order.updateItemQuantity(input.itemId, input.quantity);

    return await this.orderRepository.save(order);
  }
}
