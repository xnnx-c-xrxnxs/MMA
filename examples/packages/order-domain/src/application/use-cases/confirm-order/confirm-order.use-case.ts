/**
 * ConfirmOrder Use Case
 * Confirms a draft order (requires items and payment)
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class ConfirmOrderUseCase implements IUseCase<string, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,
  ) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Re-validate customer is still active before confirming (ACL gate check)
    await this.customerValidator.validate(order.getCustomerId());

    // Domain entity enforces business rules
    order.confirmOrder();

    return await this.orderRepository.save(order);
  }
}
