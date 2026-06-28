/**
 * DeleteOrder Use Case
 * Hard deletes an order — only allowed for DRAFT or CANCELLED orders
 */

import { IUseCase } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class DeleteOrderUseCase implements IUseCase<string, void> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<void> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    const status = order.getOrderStatus();
    if (status !== OrderStatusEnum.DRAFT && status !== OrderStatusEnum.CANCELLED) {
      throw new InvalidInputError(
        'Only draft or cancelled orders can be deleted',
      );
    }

    await this.orderRepository.delete(orderId);
  }
}
