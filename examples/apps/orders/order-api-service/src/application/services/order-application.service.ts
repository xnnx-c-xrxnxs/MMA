import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IOffsetPaginatedResponse } from '@old-st/common';

const logger = createLogger('order-api-service');
import {
  orderResponseSchema,
  CreateOrderInput,
  OrderResponse,
  ListOrdersByCustomerInput,
  ListOrdersByStatusInput,
  AddOrderItemInput,
  RemoveOrderItemInput,
  UpdateOrderItemQuantityInput,
  AddOrderPaymentInput,
} from '@old-st/contracts/order';
import { OffsetPaginatedResponse } from '@old-st/contracts/common';
import {
  Order,
  OrderItem,
  OrderPayment,
  CreateOrderUseCase,
  GetOrderByIdUseCase,
  DeleteOrderUseCase,
  AddOrderItemUseCase,
  RemoveOrderItemUseCase,
  UpdateOrderItemQuantityUseCase,
  ConfirmOrderUseCase,
  StartProcessingOrderUseCase,
  ShipOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
  RefundOrderUseCase,
  ListOrdersByCustomerUseCase,
  ListOrdersByStatusUseCase,
  AddOrderPaymentUseCase,
  AuthorizePaymentUseCase,
  CapturePaymentUseCase,
} from '@old-st/order-domain';

@Injectable()
export class OrderApplicationService {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly deleteOrderUseCase: DeleteOrderUseCase,
    private readonly addOrderItemUseCase: AddOrderItemUseCase,
    private readonly removeOrderItemUseCase: RemoveOrderItemUseCase,
    private readonly updateOrderItemQuantityUseCase: UpdateOrderItemQuantityUseCase,
    private readonly confirmOrderUseCase: ConfirmOrderUseCase,
    private readonly startProcessingOrderUseCase: StartProcessingOrderUseCase,
    private readonly shipOrderUseCase: ShipOrderUseCase,
    private readonly deliverOrderUseCase: DeliverOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly refundOrderUseCase: RefundOrderUseCase,
    private readonly listOrdersByCustomerUseCase: ListOrdersByCustomerUseCase,
    private readonly listOrdersByStatusUseCase: ListOrdersByStatusUseCase,
    private readonly addOrderPaymentUseCase: AddOrderPaymentUseCase,
    private readonly authorizePaymentUseCase: AuthorizePaymentUseCase,
    private readonly capturePaymentUseCase: CapturePaymentUseCase,
  ) {}

  private toItemDto(item: OrderItem) {
    return {
      itemId: item.getItemId(),
      productId: item.getProductId(),
      productName: item.getProductName(),
      quantity: item.getQuantity(),
      price: item.getPrice(),
      latestKnownPrice: item.getLatestKnownPrice(),
    };
  }

  private toPaymentDto(payment: OrderPayment | null) {
    if (!payment) return null;
    return {
      paymentId: payment.getPaymentId(),
      paymentMethod: payment.getPaymentMethod(),
      paymentStatus: payment.getPaymentStatus(),
      amount: payment.getAmount(),
      transactionId: payment.getTransactionId(),
    };
  }

  private toDto(order: Order): OrderResponse {
    return orderResponseSchema.parse({
      orderId: order.getOrderId(),
      customerId: order.getCustomerId(),
      items: order.getItems().map((item) => this.toItemDto(item)),
      payment: this.toPaymentDto(order.getPayment()),
      orderStatus: order.getOrderStatus(),
      totalAmount: order.getTotalAmount(),
      dateCreated: order.getDateCreated(),
      updatedAt: order.getUpdatedAt(),
    });
  }

  private toPaginatedDto(
    result: IOffsetPaginatedResponse<Order>,
  ): OffsetPaginatedResponse<OrderResponse> {
    return {
      data: result.data.map((order) => this.toDto(order)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResponse> {
    logger.info('Creating order', { customerId: input.customerId, itemCount: input.items?.length ?? 0 });
    const order = await this.createOrderUseCase.execute({
      customerId: input.customerId,
      items: input.items,
    });
    logger.info('Order created', { orderId: order.getOrderId(), customerId: order.getCustomerId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async getOrderById(orderId: string): Promise<OrderResponse> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    return this.toDto(order);
  }

  async deleteOrder(orderId: string): Promise<void> {
    logger.info('Deleting order', { orderId });
    await this.deleteOrderUseCase.execute(orderId);
    logger.info('Order deleted', { orderId });
  }

  async addOrderItem(orderId: string, input: AddOrderItemInput): Promise<OrderResponse> {
    logger.info('Adding item to order', { orderId, productId: input.productId, quantity: input.quantity });
    const order = await this.addOrderItemUseCase.execute({
      orderId,
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      price: input.price,
    });
    logger.info('Item added to order', { orderId: order.getOrderId(), itemCount: order.getItems().length });
    return this.toDto(order);
  }

  async removeOrderItem(orderId: string, itemId: string): Promise<OrderResponse> {
    logger.info('Removing item from order', { orderId, itemId });
    const order = await this.removeOrderItemUseCase.execute({
      orderId,
      itemId,
    });
    logger.info('Item removed from order', { orderId: order.getOrderId(), itemCount: order.getItems().length });
    return this.toDto(order);
  }

  async updateOrderItemQuantity(
    orderId: string,
    input: UpdateOrderItemQuantityInput,
  ): Promise<OrderResponse> {
    logger.info('Updating order item quantity', { orderId, itemId: input.itemId, quantity: input.quantity });
    const order = await this.updateOrderItemQuantityUseCase.execute({
      orderId,
      itemId: input.itemId,
      quantity: input.quantity,
    });
    logger.info('Order item quantity updated', { orderId: order.getOrderId(), itemId: input.itemId });
    return this.toDto(order);
  }

  async confirmOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Confirming order', { orderId });
    const order = await this.confirmOrderUseCase.execute(orderId);
    logger.info('Order confirmed', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async startProcessingOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Starting order processing', { orderId });
    const order = await this.startProcessingOrderUseCase.execute(orderId);
    logger.info('Order processing started', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async shipOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Shipping order', { orderId });
    const order = await this.shipOrderUseCase.execute(orderId);
    logger.info('Order shipped', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async deliverOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Delivering order', { orderId });
    const order = await this.deliverOrderUseCase.execute(orderId);
    logger.info('Order delivered', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async cancelOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Cancelling order', { orderId });
    const order = await this.cancelOrderUseCase.execute(orderId);
    logger.info('Order cancelled', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async refundOrder(orderId: string): Promise<OrderResponse> {
    logger.info('Refunding order', { orderId });
    const order = await this.refundOrderUseCase.execute(orderId);
    logger.info('Order refunded', { orderId: order.getOrderId(), orderStatus: order.getOrderStatus() });
    return this.toDto(order);
  }

  async listOrdersByCustomer(
    input: ListOrdersByCustomerInput,
  ): Promise<OffsetPaginatedResponse<OrderResponse>> {
    const result = await this.listOrdersByCustomerUseCase.execute({
      customerId: input.customerId,
      page: input.page,
      limit: input.limit,
    });
    return this.toPaginatedDto(result);
  }

  async listOrdersByStatus(
    input: ListOrdersByStatusInput,
  ): Promise<OffsetPaginatedResponse<OrderResponse>> {
    const result = await this.listOrdersByStatusUseCase.execute({
      status: input.orderStatus,
      page: input.page,
      limit: input.limit,
    });
    return this.toPaginatedDto(result);
  }

  async addOrderPayment(
    orderId: string,
    input: AddOrderPaymentInput,
  ): Promise<OrderResponse> {
    logger.info('Adding payment to order', { orderId, paymentMethod: input.paymentMethod, amount: input.amount });
    const order = await this.addOrderPaymentUseCase.execute({
      orderId,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
    });
    logger.info('Payment added to order', { orderId: order.getOrderId() });
    return this.toDto(order);
  }

  async authorizePayment(
    orderId: string,
    transactionId: string,
  ): Promise<OrderResponse> {
    logger.info('Authorizing payment', { orderId, transactionId });
    const order = await this.authorizePaymentUseCase.execute({
      orderId,
      transactionId,
    });
    logger.info('Payment authorized', { orderId: order.getOrderId(), transactionId });
    return this.toDto(order);
  }

  async capturePayment(orderId: string): Promise<OrderResponse> {
    logger.info('Capturing payment', { orderId });
    const order = await this.capturePaymentUseCase.execute(orderId);
    logger.info('Payment captured', { orderId: order.getOrderId() });
    return this.toDto(order);
  }
}
