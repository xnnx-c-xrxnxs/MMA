/**
 * Order Repository Interface
 * Defines the contract for order data access operations
 */

import { IOffsetPaginatedResponse } from '@old-st/common';
import { OrderStatus } from '../../domain/constants';
import { Order } from '../../domain/entities';

export abstract class IOrderRepository {
  /**
   * Save an order entity (create or update)
   * Saves Order + OrderItems + OrderPayment in one operation
   */
  abstract save(order: Order): Promise<Order>;

  /**
   * Find order by ID (loads complete aggregate)
   */
  abstract findById(orderId: string): Promise<Order | null>;

  /**
   * Find orders by customer ID (offset-paginated)
   */
  abstract findByCustomerId(
    customerId: string,
    page?: number,
    limit?: number,
  ): Promise<IOffsetPaginatedResponse<Order>>;

  /**
   * Find orders by status (offset-paginated)
   */
  abstract findByStatus(
    orderStatus: OrderStatus,
    page?: number,
    limit?: number,
  ): Promise<IOffsetPaginatedResponse<Order>>;

  /**
   * Find orders containing a specific product (offset-paginated)
   */
  abstract findByProductId(
    productId: string,
    page?: number,
    limit?: number,
  ): Promise<IOffsetPaginatedResponse<Order>>;

  /**
   * Delete an order (hard delete)
   */
  abstract delete(orderId: string): Promise<void>;
}
