/**
 * RefundOrder Use Case
 * Refunds a delivered order with successful payment
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class RefundOrderUseCase implements IUseCase<string, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Domain entity enforces: must be DELIVERED + has successful payment
    order.refund();

    return await this.orderRepository.save(order);
  }
}
