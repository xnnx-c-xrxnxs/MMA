/**
 * ApproveProductValidation Use Case
 * Transitions order from DRAFT → PENDING after product validation succeeds
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderNotFoundError } from '../../exceptions';

export class ApproveProductValidationUseCase
  implements IUseCase<string, Order>
{
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Domain exception thrown here if business rules are violated
    order.approveProductValidation();

    return await this.orderRepository.save(order);
  }
}
