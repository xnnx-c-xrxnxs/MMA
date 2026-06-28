/**
 * CapturePayment Use Case
 * Captures an authorized payment on an order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class CapturePaymentUseCase implements IUseCase<string, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    const payment = order.getPayment();
    if (!payment) {
      throw new InvalidInputError('Order has no payment');
    }

    // Domain entity enforces: must be AUTHORIZED
    payment.capture();

    return await this.orderRepository.save(order);
  }
}
