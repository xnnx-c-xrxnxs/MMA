/**
 * GetOrderById Use Case
 * Retrieves an order by its unique identifier
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class GetOrderByIdUseCase implements IUseCase<string, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    return order;
  }
}
