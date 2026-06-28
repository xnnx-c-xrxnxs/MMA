/**
 * CreateOrder Use Case
 * Creates a new draft order with items and publishes ORDER_CREATED event
 */

import { IUseCase, IEventPublisher } from '@old-st/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderEventTypeEnum } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

export interface CreateOrderInput {
  customerId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
}

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,
    private readonly eventPublisher: IEventPublisher<unknown>,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.customerId) {
      throw new InvalidInputError('Customer ID is required');
    }

    if (!input.items || input.items.length === 0) {
      throw new InvalidInputError('At least one item is required');
    }

    // Validate customer exists and is active (ACL gate check)
    await this.customerValidator.validate(input.customerId);

    // Create domain entity (business validation happens here)
    const order = Order.create({ customerId: input.customerId });

    // Add items (entity enforces business rules)
    for (const itemInput of input.items) {
      const item = OrderItem.create({
        productId: itemInput.productId,
        productName: itemInput.productName,
        quantity: itemInput.quantity,
        price: itemInput.price,
      });
      order.addItem(item);
    }

    // Persist
    const savedOrder = await this.orderRepository.save(order);

    // Publish ORDER_CREATED event for async product validation
    const orderId = savedOrder.getOrderId();
    if (orderId) {
      await this.eventPublisher.publish({
        eventType: OrderEventTypeEnum.ORDER_CREATED,
        orderId,
        customerId: input.customerId,
        items: input.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
        })),
        occurredAt: new Date().toISOString(),
      }, { groupId: orderId });
    }

    return savedOrder;
  }
}
