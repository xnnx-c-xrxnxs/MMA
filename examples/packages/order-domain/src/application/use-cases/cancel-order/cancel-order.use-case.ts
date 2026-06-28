/**
 * CancelOrder Use Case
 * Cancels an order (cannot cancel delivered or refunded)
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class CancelOrderUseCase implements IUseCase<string, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    order.cancel();

    return await this.orderRepository.save(order);
  }
}
