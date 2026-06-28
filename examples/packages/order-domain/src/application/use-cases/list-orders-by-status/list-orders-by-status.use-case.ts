/**
 * ListOrdersByStatus Use Case
 * Lists orders filtered by status with offset-based pagination
 */

import { IUseCase, IOffsetPaginatedResponse } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ORDER_STATUSES, OrderStatus } from '../../../domain/constants';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, InvalidOrderStatusError } from '../../exceptions';

export interface ListOrdersByStatusInput {
  status: OrderStatus;
  page?: number;
  limit?: number;
}

export class ListOrdersByStatusUseCase implements IUseCase<ListOrdersByStatusInput, IOffsetPaginatedResponse<Order>> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: ListOrdersByStatusInput): Promise<IOffsetPaginatedResponse<Order>> {
    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }

    if (!ORDER_STATUSES.includes(input.status)) {
      throw new InvalidOrderStatusError(input.status);
    }

    return await this.orderRepository.findByStatus(
      input.status,
      input.page,
      input.limit,
    );
  }
}
