import { PrismaClient, Order as PrismaOrder, OrderItem as PrismaOrderItem, OrderPayment as PrismaOrderPayment } from '../generated/client';
import { IOffsetPaginatedResponse, createOffsetPaginatedResponse } from '@old-st/common';
import { IOrderRepository } from '../../application/interfaces/order-repository.interface';
import { Order } from '../../domain/entities/order.entity';
import { OrderItem } from '../../domain/entities/order-item.entity';
import { OrderPayment } from '../../domain/entities/order-payment.entity';
import { OrderStatus } from '../../domain/constants';

/**
 * Prisma Order Repository Implementation
 * Handles all order CRUD operations using Prisma + PostgreSQL
 * Manages Order aggregate (Order + OrderItems + OrderPayment)
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(order: Order): Promise<Order> {
    const orderId = order.getOrderId();

    if (orderId) {
      // Update existing order using a transaction
      await this.prisma.$transaction(async (tx) => {
        // 1. Update order metadata
        await tx.order.update({
          where: { orderId },
          data: {
            customerId: order.getCustomerId(),
            orderStatus: order.getOrderStatus(),
            totalAmount: order.getTotalAmount(),
          },
        });

        // 2. Delete existing items and payment (simpler than selective upsert)
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderPayment.deleteMany({ where: { orderId } });

        // 3. Create items
        const items = order.getItems();
        if (items.length > 0) {
          await tx.orderItem.createMany({
            data: items.map((item) => ({
              orderId,
              productId: item.getProductId(),
              productName: item.getProductName(),
              quantity: item.getQuantity(),
              price: item.getPrice(),
              latestKnownPrice: item.getLatestKnownPrice(),
            })),
          });
        }

        // 4. Create payment if exists
        const payment = order.getPayment();
        if (payment) {
          await tx.orderPayment.create({
            data: {
              orderId,
              paymentMethod: payment.getPaymentMethod(),
              paymentStatus: payment.getPaymentStatus(),
              amount: payment.getAmount(),
              transactionId: payment.getTransactionId(),
            },
          });
        }
      });

      return this.findById(orderId) as Promise<Order>;
    }

    // Create new order in a transaction
    const created = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId: order.getCustomerId(),
          orderStatus: order.getOrderStatus(),
          totalAmount: order.getTotalAmount(),
        },
      });

      const items = order.getItems();
      if (items.length > 0) {
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: newOrder.orderId,
            productId: item.getProductId(),
            productName: item.getProductName(),
            quantity: item.getQuantity(),
            price: item.getPrice(),
            latestKnownPrice: item.getLatestKnownPrice(),
          })),
        });
      }

      const payment = order.getPayment();
      if (payment) {
        await tx.orderPayment.create({
          data: {
            orderId: newOrder.orderId,
            paymentMethod: payment.getPaymentMethod(),
            paymentStatus: payment.getPaymentStatus(),
            amount: payment.getAmount(),
            transactionId: payment.getTransactionId(),
          },
        });
      }

      return newOrder;
    });

    return this.findById(created.orderId) as Promise<Order>;
  }

  async findById(orderId: string): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: { orderId },
      include: { items: true, payment: true },
    });

    if (!record) return null;

    return this.toDomain(record, record.items, record.payment);
  }

  async findByCustomerId(
    customerId: string,
    page = 1,
    limit = 20,
  ): Promise<IOffsetPaginatedResponse<Order>> {
    const where = { customerId };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateCreated: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    const orders = records.map((r) => this.toDomain(r, r.items, r.payment));

    return createOffsetPaginatedResponse(orders, total, page, limit);
  }

  async findByStatus(
    orderStatus: OrderStatus,
    page = 1,
    limit = 20,
  ): Promise<IOffsetPaginatedResponse<Order>> {
    const where = { orderStatus };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateCreated: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    const orders = records.map((r) => this.toDomain(r, r.items, r.payment));

    return createOffsetPaginatedResponse(orders, total, page, limit);
  }

  async findByProductId(
    productId: string,
    page = 1,
    limit = 50,
  ): Promise<IOffsetPaginatedResponse<Order>> {
    const where = { items: { some: { productId } } };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateCreated: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    const orders = records.map((r) => this.toDomain(r, r.items, r.payment));

    return createOffsetPaginatedResponse(orders, total, page, limit);
  }

  async delete(orderId: string): Promise<void> {
    await this.prisma.order.delete({ where: { orderId } });
  }

  private toDomain(
    record: PrismaOrder,
    items: PrismaOrderItem[],
    payment: PrismaOrderPayment | null,
  ): Order {
    const domainItems = items.map((item) =>
      OrderItem.reconstitute({
        itemId: item.itemId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        latestKnownPrice: item.latestKnownPrice,
        dateCreated: item.dateCreated.toISOString(),
      }),
    );

    const domainPayment = payment
      ? OrderPayment.reconstitute({
          paymentId: payment.paymentId,
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
          paymentStatus: payment.paymentStatus,
          transactionId: payment.transactionId,
          dateCreated: payment.dateCreated.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
        })
      : null;

    return Order.reconstitute({
      orderId: record.orderId,
      customerId: record.customerId,
      items: domainItems,
      payment: domainPayment,
      orderStatus: record.orderStatus,
      totalAmount: record.totalAmount,
      dateCreated: record.dateCreated.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }
}
