import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderPayment } from './order-payment.entity';
import { OrderStatusEnum, PaymentStatusEnum } from '../constants';
import {
  CustomerIdRequiredError,
  CannotModifyNonDraftOrderError,
  OrderItemNotFoundError,
  OrderAlreadyHasPaymentError,
  PaymentAmountMismatchError,
  InvalidOrderStatusTransitionError,
  CannotConfirmEmptyOrderError,
  PaymentRequiredForConfirmationError,
  InvalidPaymentStateForConfirmationError,
  CannotCancelOrderError,
  CannotRefundOrderError,
  CannotApproveProductValidationError,
  CannotFailValidationError,
} from '../exceptions';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDraftOrder(): Order {
  return Order.create({ customerId: 'cust-1' });
}

function makeItem(price = 10, quantity = 2, productId = 'prod-1'): OrderItem {
  return OrderItem.create({ productId, productName: 'Widget', quantity, price });
}

function makePayment(amount: number): OrderPayment {
  return OrderPayment.create({ paymentMethod: 'CREDIT_CARD', amount });
}

function makeDraftOrderWithItem(
  price = 10,
  quantity = 2,
): { order: Order; item: OrderItem } {
  const order = makeDraftOrder();
  const item = makeItem(price, quantity);
  order.addItem(item);
  return { order, item };
}

function makeConfirmableOrder(): Order {
  const now = new Date().toISOString();
  const item = OrderItem.reconstitute({
    itemId: 'item-1',
    productId: 'prod-1',
    productName: 'Widget',
    quantity: 1,
    price: 50,
    latestKnownPrice: null,
    dateCreated: now,
  });
  const payment = OrderPayment.reconstitute({
    paymentId: 'pay-1',
    paymentMethod: 'CREDIT_CARD',
    amount: 50,
    paymentStatus: 'PENDING',
    transactionId: null,
    dateCreated: now,
    updatedAt: now,
  });
  return Order.reconstitute({
    orderId: 'ord-confirm',
    customerId: 'cust-1',
    items: [item],
    payment,
    orderStatus: OrderStatusEnum.PENDING,
    totalAmount: 50,
    dateCreated: now,
    updatedAt: now,
  });
}

function makeReconstitutedOrder(
  overrides: Partial<{
    orderId: string;
    customerId: string;
    items: OrderItem[];
    payment: OrderPayment | null;
    orderStatus: string;
    totalAmount: number;
  }> = {},
): Order {
  const now = new Date().toISOString();
  return Order.reconstitute({
    orderId: overrides.orderId ?? 'ord-123',
    customerId: overrides.customerId ?? 'cust-1',
    items: overrides.items ?? [],
    payment: overrides.payment ?? null,
    orderStatus: (overrides.orderStatus as any) ?? OrderStatusEnum.DRAFT,
    totalAmount: overrides.totalAmount ?? 0,
    dateCreated: now,
    updatedAt: now,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Order Entity', () => {
  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a draft order with no items', () => {
      const order = makeDraftOrder();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.DRAFT);
      expect(order.getItems()).toEqual([]);
      expect(order.getPayment()).toBeNull();
      expect(order.getTotalAmount()).toBe(0);
      expect(order.getCustomerId()).toBe('cust-1');
      expect(order.getOrderId()).toBeNull();
      expect(order.getDateCreated()).toBeDefined();
    });

    it('should throw CustomerIdRequiredError for empty customerId', () => {
      expect(() => Order.create({ customerId: '' })).toThrow(
        CustomerIdRequiredError,
      );
    });

    it('should throw CustomerIdRequiredError for whitespace-only customerId', () => {
      expect(() => Order.create({ customerId: '   ' })).toThrow(
        CustomerIdRequiredError,
      );
    });
  });

  // ── reconstitute() ────────────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('should restore all fields correctly', () => {
      const item = OrderItem.reconstitute({
        itemId: 'item-1',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 2,
        price: 10,
        latestKnownPrice: null,
        dateCreated: '2024-01-01T00:00:00.000Z',
      });
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 20,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const order = Order.reconstitute({
        orderId: 'ord-999',
        customerId: 'cust-1',
        items: [item],
        payment,
        orderStatus: OrderStatusEnum.DELIVERED,
        totalAmount: 20,
        dateCreated: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      expect(order.getOrderId()).toBe('ord-999');
      expect(order.getCustomerId()).toBe('cust-1');
      expect(order.getItems()).toHaveLength(1);
      expect(order.getPayment()).toBe(payment);
      expect(order.getOrderStatus()).toBe(OrderStatusEnum.DELIVERED);
      expect(order.getTotalAmount()).toBe(20);
    });
  });

  // ── addItem() ─────────────────────────────────────────────────────────────

  describe('addItem()', () => {
    it('should add an item and recalculate total', () => {
      const order = makeDraftOrder();
      const item = makeItem(10, 3);

      order.addItem(item);

      expect(order.getItems()).toHaveLength(1);
      expect(order.getTotalAmount()).toBe(30);
    });

    it('should add multiple items', () => {
      const order = makeDraftOrder();
      order.addItem(makeItem(10, 1));
      order.addItem(makeItem(20, 2));

      expect(order.getItems()).toHaveLength(2);
      expect(order.getTotalAmount()).toBe(50);
    });

    it('should throw CannotModifyNonDraftOrderError when order is CONFIRMED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      expect(() => order.addItem(makeItem())).toThrow(
        CannotModifyNonDraftOrderError,
      );
    });
  });

  // ── removeItem() ──────────────────────────────────────────────────────────

  describe('removeItem()', () => {
    it('should remove an item by id and recalculate total', () => {
      const order = makeDraftOrder();
      const item = OrderItem.reconstitute({
        itemId: 'item-1',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 2,
        price: 10,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      });
      order.addItem(item);
      expect(order.getTotalAmount()).toBe(20);

      order.removeItem('item-1');

      expect(order.getItems()).toHaveLength(0);
      expect(order.getTotalAmount()).toBe(0);
    });

    it('should throw CannotModifyNonDraftOrderError when not DRAFT', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PROCESSING,
      });

      expect(() => order.removeItem('item-1')).toThrow(
        CannotModifyNonDraftOrderError,
      );
    });
  });

  // ── updateItemQuantity() ──────────────────────────────────────────────────

  describe('updateItemQuantity()', () => {
    it('should update item quantity and recalculate total', () => {
      const order = makeDraftOrder();
      const item = OrderItem.reconstitute({
        itemId: 'item-1',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 2,
        price: 10,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      });
      order.addItem(item);
      expect(order.getTotalAmount()).toBe(20);

      order.updateItemQuantity('item-1', 5);

      expect(order.getTotalAmount()).toBe(50);
    });

    it('should throw OrderItemNotFoundError when item does not exist', () => {
      const order = makeDraftOrder();

      expect(() => order.updateItemQuantity('nonexistent', 3)).toThrow(
        OrderItemNotFoundError,
      );
    });

    it('should throw CannotModifyNonDraftOrderError when not DRAFT', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.SHIPPED,
      });

      expect(() => order.updateItemQuantity('item-1', 3)).toThrow(
        CannotModifyNonDraftOrderError,
      );
    });
  });

  // ── addPayment() ──────────────────────────────────────────────────────────

  describe('addPayment()', () => {
    it('should add payment when amount matches total', () => {
      const { order } = makeDraftOrderWithItem(10, 2); // total = 20
      const payment = makePayment(20);

      order.addPayment(payment);

      expect(order.getPayment()).toBe(payment);
    });

    it('should throw OrderAlreadyHasPaymentError when payment already attached', () => {
      const { order } = makeDraftOrderWithItem(10, 1); // total = 10
      order.addPayment(makePayment(10));

      expect(() => order.addPayment(makePayment(10))).toThrow(
        OrderAlreadyHasPaymentError,
      );
    });

    it('should throw PaymentAmountMismatchError when amount does not match total', () => {
      const { order } = makeDraftOrderWithItem(10, 2); // total = 20

      expect(() => order.addPayment(makePayment(15))).toThrow(
        PaymentAmountMismatchError,
      );
    });
  });

  // ── confirmOrder() ────────────────────────────────────────────────────────

  describe('confirmOrder()', () => {
    it('should confirm a PENDING order with items and payment', () => {
      const order = makeConfirmableOrder();

      order.confirmOrder();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.CONFIRMED);
    });

    it('should throw InvalidOrderStatusTransitionError when not PENDING', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DRAFT,
      });

      expect(() => order.confirmOrder()).toThrow(
        InvalidOrderStatusTransitionError,
      );
    });

    it('should throw CannotConfirmEmptyOrderError when no items', () => {
      const orderWithPayment = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PENDING,
        payment: OrderPayment.reconstitute({
          paymentId: 'pay-1',
          paymentMethod: 'CREDIT_CARD',
          amount: 0,
          paymentStatus: 'PENDING',
          transactionId: null,
          dateCreated: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });

      expect(() => orderWithPayment.confirmOrder()).toThrow(
        CannotConfirmEmptyOrderError,
      );
    });

    it('should throw PaymentRequiredForConfirmationError when no payment', () => {
      const item = OrderItem.reconstitute({
        itemId: 'item-1',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 50,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      });
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PENDING,
        items: [item],
        totalAmount: 50,
      });

      expect(() => order.confirmOrder()).toThrow(
        PaymentRequiredForConfirmationError,
      );
    });

    it('should throw InvalidPaymentStateForConfirmationError when payment is FAILED', () => {
      const item = OrderItem.reconstitute({
        itemId: 'item-1',
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 50,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      });
      const failedPayment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 50,
        paymentStatus: 'FAILED',
        transactionId: null,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const order = Order.reconstitute({
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [item],
        payment: failedPayment,
        orderStatus: OrderStatusEnum.PENDING,
        totalAmount: 50,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => order.confirmOrder()).toThrow(
        InvalidPaymentStateForConfirmationError,
      );
    });
  });

  // ── startProcessing() ─────────────────────────────────────────────────────

  describe('startProcessing()', () => {
    it('should transition CONFIRMED → PROCESSING', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      order.startProcessing();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.PROCESSING);
    });

    it('should throw when not CONFIRMED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DRAFT,
      });

      expect(() => order.startProcessing()).toThrow(
        InvalidOrderStatusTransitionError,
      );
    });
  });

  // ── ship() ────────────────────────────────────────────────────────────────

  describe('ship()', () => {
    it('should transition PROCESSING → SHIPPED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PROCESSING,
      });

      order.ship();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.SHIPPED);
    });

    it('should throw when not PROCESSING', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      expect(() => order.ship()).toThrow(InvalidOrderStatusTransitionError);
    });
  });

  // ── deliver() ─────────────────────────────────────────────────────────────

  describe('deliver()', () => {
    it('should transition SHIPPED → DELIVERED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.SHIPPED,
      });

      order.deliver();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.DELIVERED);
    });

    it('should throw when not SHIPPED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PROCESSING,
      });

      expect(() => order.deliver()).toThrow(InvalidOrderStatusTransitionError);
    });
  });

  // ── cancel() ──────────────────────────────────────────────────────────────

  describe('cancel()', () => {
    it('should cancel a DRAFT order', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DRAFT,
      });

      order.cancel();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
    });

    it('should cancel a CONFIRMED order', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      order.cancel();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
    });

    it('should cancel a PROCESSING order', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PROCESSING,
      });

      order.cancel();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
    });

    it('should fail pending payment when cancelling', () => {
      const pendingPayment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'PENDING',
        transactionId: null,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
        payment: pendingPayment,
      });

      order.cancel();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
      expect(order.getPayment()?.getPaymentStatus()).toBe(
        PaymentStatusEnum.FAILED,
      );
    });

    it('should throw CannotCancelOrderError when DELIVERED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DELIVERED,
      });

      expect(() => order.cancel()).toThrow(CannotCancelOrderError);
    });

    it('should throw CannotCancelOrderError when REFUNDED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.REFUNDED,
      });

      expect(() => order.cancel()).toThrow(CannotCancelOrderError);
    });

    it('should throw CannotCancelOrderError when VALIDATION_FAILED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.VALIDATION_FAILED,
      });

      expect(() => order.cancel()).toThrow(CannotCancelOrderError);
    });
  });

  // ── refund() ──────────────────────────────────────────────────────────────

  describe('refund()', () => {
    it('should refund a DELIVERED order with successful payment', () => {
      const capturedPayment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DELIVERED,
        payment: capturedPayment,
      });

      order.refund();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.REFUNDED);
      expect(order.getPayment()?.getPaymentStatus()).toBe(
        PaymentStatusEnum.REFUNDED,
      );
    });

    it('should throw CannotRefundOrderError when not DELIVERED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PROCESSING,
      });

      expect(() => order.refund()).toThrow(CannotRefundOrderError);
    });

    it('should throw CannotRefundOrderError when no successful payment', () => {
      const pendingPayment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'PENDING',
        transactionId: null,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DELIVERED,
        payment: pendingPayment,
      });

      expect(() => order.refund()).toThrow(CannotRefundOrderError);
    });

    it('should throw CannotRefundOrderError when no payment at all', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DELIVERED,
        payment: null,
      });

      expect(() => order.refund()).toThrow(CannotRefundOrderError);
    });
  });

  // ── approveProductValidation() ─────────────────────────────────────────────

  describe('approveProductValidation()', () => {
    it('should transition DRAFT → PENDING', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DRAFT,
      });

      order.approveProductValidation();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.PENDING);
    });

    it('should throw CannotApproveProductValidationError when not DRAFT', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PENDING,
      });

      expect(() => order.approveProductValidation()).toThrow(
        CannotApproveProductValidationError,
      );
    });

    it('should throw CannotApproveProductValidationError when CONFIRMED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      expect(() => order.approveProductValidation()).toThrow(
        CannotApproveProductValidationError,
      );
    });
  });

  // ── failValidation() ──────────────────────────────────────────────────────

  describe('failValidation()', () => {
    it('should transition DRAFT → VALIDATION_FAILED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DRAFT,
      });

      order.failValidation();

      expect(order.getOrderStatus()).toBe(OrderStatusEnum.VALIDATION_FAILED);
    });

    it('should throw CannotFailValidationError when not DRAFT', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PENDING,
      });

      expect(() => order.failValidation()).toThrow(CannotFailValidationError);
    });

    it('should throw CannotFailValidationError when CONFIRMED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });

      expect(() => order.failValidation()).toThrow(CannotFailValidationError);
    });
  });

  // ── Status helper getters ─────────────────────────────────────────────────

  describe('status helpers', () => {
    it('isDraft() should return true for DRAFT', () => {
      expect(makeDraftOrder().isDraft()).toBe(true);
    });

    it('isConfirmed() should return true for CONFIRMED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CONFIRMED,
      });
      expect(order.isConfirmed()).toBe(true);
    });

    it('isDelivered() should return true for DELIVERED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.DELIVERED,
      });
      expect(order.isDelivered()).toBe(true);
    });

    it('isCancelled() should return true for CANCELLED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.CANCELLED,
      });
      expect(order.isCancelled()).toBe(true);
    });

    it('isPending() should return true for PENDING', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.PENDING,
      });
      expect(order.isPending()).toBe(true);
    });

    it('isValidationFailed() should return true for VALIDATION_FAILED', () => {
      const order = makeReconstitutedOrder({
        orderStatus: OrderStatusEnum.VALIDATION_FAILED,
      });
      expect(order.isValidationFailed()).toBe(true);
    });
  });

  // ── getItems() returns a copy ────────────────────────────────────────────

  describe('getItems()', () => {
    it('should return a copy of items array', () => {
      const order = makeDraftOrder();
      const items1 = order.getItems();
      const items2 = order.getItems();
      expect(items1).not.toBe(items2);
    });
  });
});
