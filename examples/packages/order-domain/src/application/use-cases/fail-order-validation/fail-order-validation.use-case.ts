/**
 * FailOrderValidation Use Case
 * Transitions order from DRAFT → VALIDATION_FAILED after product validation fails
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderNotFoundError } from '../../exceptions';

export class FailOrderValidationUseCase implements IUseCase<string, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Domain exception thrown here if business rules are violated
    order.failValidation();

    return await this.orderRepository.save(order);
  }
}
