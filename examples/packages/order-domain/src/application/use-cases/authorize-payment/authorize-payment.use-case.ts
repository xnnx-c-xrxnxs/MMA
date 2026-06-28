/**
 * AuthorizePayment Use Case
 * Authorizes a pending payment on an order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export interface AuthorizePaymentInput {
  orderId: string;
  transactionId: string;
}

export class AuthorizePaymentUseCase implements IUseCase<AuthorizePaymentInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: AuthorizePaymentInput): Promise<Order> {
    if (!input.orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    if (!input.transactionId) {
      throw new InvalidInputError('Transaction ID is required');
    }

    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    const payment = order.getPayment();
    if (!payment) {
      throw new InvalidInputError('Order has no payment');
    }

    // Domain entity enforces: must be PENDING
    payment.authorize(input.transactionId);

    return await this.orderRepository.save(order);
  }
}
