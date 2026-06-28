/**
 * AddOrderItem Use Case
 * Adds an item to a draft order
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export interface AddOrderItemInput {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export class AddOrderItemUseCase implements IUseCase<AddOrderItemInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: AddOrderItemInput): Promise<Order> {
    if (!input.orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    // Domain entity validates business rules (must be DRAFT)
    const item = OrderItem.create({
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      price: input.price,
    });
    order.addItem(item);

    return await this.orderRepository.save(order);
  }
}
