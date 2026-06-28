/**
 * AddOrderPayment Use Case
 * Attaches a payment to an order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderPayment } from '../../../domain/entities/order-payment.entity';
import { PaymentMethod, PAYMENT_METHODS } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError, InvalidPaymentMethodError } from '../../exceptions';

export interface AddOrderPaymentInput {
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number;
}

export class AddOrderPaymentUseCase implements IUseCase<AddOrderPaymentInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: AddOrderPaymentInput): Promise<Order> {
    if (!input.orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    if (!input.paymentMethod) {
      throw new InvalidInputError('Payment method is required');
    }

    if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
      throw new InvalidPaymentMethodError(input.paymentMethod);
    }

    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    // Domain entity validates business rules (no duplicate payment, amount match)
    const payment = OrderPayment.create({
      paymentMethod: input.paymentMethod,
      amount: input.amount,
    });
    order.addPayment(payment);

    return await this.orderRepository.save(order);
  }
}
