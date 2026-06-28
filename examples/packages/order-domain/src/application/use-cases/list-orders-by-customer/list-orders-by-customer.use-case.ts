/**
 * ListOrdersByCustomer Use Case
 * Lists orders for a specific customer with offset-based pagination
 */

import { IUseCase, IOffsetPaginatedResponse } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError } from '../../exceptions';

export interface ListOrdersByCustomerInput {
  customerId: string;
  page?: number;
  limit?: number;
}

export class ListOrdersByCustomerUseCase implements IUseCase<ListOrdersByCustomerInput, IOffsetPaginatedResponse<Order>> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: ListOrdersByCustomerInput): Promise<IOffsetPaginatedResponse<Order>> {
    if (!input.customerId) {
      throw new InvalidInputError('Customer ID is required');
    }

    return await this.orderRepository.findByCustomerId(
      input.customerId,
      input.page,
      input.limit,
    );
  }
}
