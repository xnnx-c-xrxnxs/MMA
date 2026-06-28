import { OrderApplicationService } from './order-application.service';
import { Order, OrderItem, OrderPayment } from '@old-st/order-domain';

jest.mock('@old-st/contracts/order', () => ({
  ...jest.requireActual('@old-st/contracts/order'),
  orderResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

function createMockOrderItem(overrides: Partial<Record<string, unknown>> = {}): OrderItem {
  return OrderItem.reconstitute({
    itemId: 'item-1',
    productId: 'prod-1',
    productName: 'Widget',
    quantity: 2,
    price: 10,
    latestKnownPrice: null,
    dateCreated: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function createMockOrder(overrides: Partial<Record<string, unknown>> = {}): Order {
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [createMockOrderItem()],
    payment: null,
    orderStatus: 'DRAFT',
    totalAmount: 20,
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function createMockUseCases() {
  return {
    createOrderUseCase: { execute: jest.fn() },
    getOrderByIdUseCase: { execute: jest.fn() },
    deleteOrderUseCase: { execute: jest.fn() },
    addOrderItemUseCase: { execute: jest.fn() },
    removeOrderItemUseCase: { execute: jest.fn() },
    updateOrderItemQuantityUseCase: { execute: jest.fn() },
    confirmOrderUseCase: { execute: jest.fn() },
    startProcessingOrderUseCase: { execute: jest.fn() },
    shipOrderUseCase: { execute: jest.fn() },
    deliverOrderUseCase: { execute: jest.fn() },
    cancelOrderUseCase: { execute: jest.fn() },
    refundOrderUseCase: { execute: jest.fn() },
    listOrdersByCustomerUseCase: { execute: jest.fn() },
    listOrdersByStatusUseCase: { execute: jest.fn() },
    addOrderPaymentUseCase: { execute: jest.fn() },
    authorizePaymentUseCase: { execute: jest.fn() },
    capturePaymentUseCase: { execute: jest.fn() },
  };
}

describe('OrderApplicationService', () => {
  let service: OrderApplicationService;
  let mocks: ReturnType<typeof createMockUseCases>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockUseCases();
    service = new OrderApplicationService(
      mocks.createOrderUseCase as any,
      mocks.getOrderByIdUseCase as any,
      mocks.deleteOrderUseCase as any,
      mocks.addOrderItemUseCase as any,
      mocks.removeOrderItemUseCase as any,
      mocks.updateOrderItemQuantityUseCase as any,
      mocks.confirmOrderUseCase as any,
      mocks.startProcessingOrderUseCase as any,
      mocks.shipOrderUseCase as any,
      mocks.deliverOrderUseCase as any,
      mocks.cancelOrderUseCase as any,
      mocks.refundOrderUseCase as any,
      mocks.listOrdersByCustomerUseCase as any,
      mocks.listOrdersByStatusUseCase as any,
      mocks.addOrderPaymentUseCase as any,
      mocks.authorizePaymentUseCase as any,
      mocks.capturePaymentUseCase as any,
    );
  });

  describe('createOrder', () => {
    it('should delegate to use case and return DTO', async () => {
      const order = createMockOrder();
      mocks.createOrderUseCase.execute.mockResolvedValue(order);

      const result = await service.createOrder({
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 2, price: 10 }],
      });

      expect(mocks.createOrderUseCase.execute).toHaveBeenCalledWith({
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 2, price: 10 }],
      });
      expect(result.orderId).toBe('ord-1');
    });
  });

  describe('getOrderById', () => {
    it('should delegate to use case and return DTO', async () => {
      const order = createMockOrder();
      mocks.getOrderByIdUseCase.execute.mockResolvedValue(order);

      const result = await service.getOrderById('ord-1');

      expect(result.orderId).toBe('ord-1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('deleteOrder', () => {
    it('should delegate to use case', async () => {
      mocks.deleteOrderUseCase.execute.mockResolvedValue(undefined);

      await service.deleteOrder('ord-1');

      expect(mocks.deleteOrderUseCase.execute).toHaveBeenCalledWith('ord-1');
    });
  });

  describe('addOrderItem', () => {
    it('should delegate with orderId merged', async () => {
      const order = createMockOrder();
      mocks.addOrderItemUseCase.execute.mockResolvedValue(order);

      await service.addOrderItem('ord-1', {
        productId: 'prod-2',
        productName: 'Gadget',
        quantity: 1,
        price: 25,
      });

      expect(mocks.addOrderItemUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ord-1',
        productId: 'prod-2',
        productName: 'Gadget',
        quantity: 1,
        price: 25,
      });
    });
  });

  describe('removeOrderItem', () => {
    it('should delegate with orderId and itemId', async () => {
      const order = createMockOrder();
      mocks.removeOrderItemUseCase.execute.mockResolvedValue(order);

      await service.removeOrderItem('ord-1', 'item-1');

      expect(mocks.removeOrderItemUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ord-1',
        itemId: 'item-1',
      });
    });
  });

  describe('updateOrderItemQuantity', () => {
    it('should delegate with orderId and input merged', async () => {
      const order = createMockOrder();
      mocks.updateOrderItemQuantityUseCase.execute.mockResolvedValue(order);

      await service.updateOrderItemQuantity('ord-1', {
        itemId: 'item-1',
        quantity: 5,
      });

      expect(mocks.updateOrderItemQuantityUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ord-1',
        itemId: 'item-1',
        quantity: 5,
      });
    });
  });

  describe('status transition methods', () => {
    const statusMethods = [
      { method: 'confirmOrder', useCase: 'confirmOrderUseCase' },
      { method: 'startProcessingOrder', useCase: 'startProcessingOrderUseCase' },
      { method: 'shipOrder', useCase: 'shipOrderUseCase' },
      { method: 'deliverOrder', useCase: 'deliverOrderUseCase' },
      { method: 'cancelOrder', useCase: 'cancelOrderUseCase' },
      { method: 'refundOrder', useCase: 'refundOrderUseCase' },
    ] as const;

    statusMethods.forEach(({ method, useCase }) => {
      it(`${method} should delegate to ${useCase} and return DTO`, async () => {
        const order = createMockOrder();
        (mocks as any)[useCase].execute.mockResolvedValue(order);

        const result = await (service as any)[method]('ord-1');

        expect((mocks as any)[useCase].execute).toHaveBeenCalledWith('ord-1');
        expect(result.orderId).toBe('ord-1');
      });
    });
  });

  describe('listOrdersByCustomer', () => {
    it('should pass page/limit and return offset-paginated DTO', async () => {
      mocks.listOrdersByCustomerUseCase.execute.mockResolvedValue({
        data: [createMockOrder()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.listOrdersByCustomer({
        customerId: 'cust-1',
        page: 1,
        limit: 20,
      });

      expect(mocks.listOrdersByCustomerUseCase.execute).toHaveBeenCalledWith({
        customerId: 'cust-1',
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('listOrdersByStatus', () => {
    it('should pass orderStatus and pagination', async () => {
      mocks.listOrdersByStatusUseCase.execute.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const result = await service.listOrdersByStatus({
        orderStatus: 'DRAFT',
        page: 1,
        limit: 10,
      });

      expect(mocks.listOrdersByStatusUseCase.execute).toHaveBeenCalledWith({
        status: 'DRAFT',
        page: 1,
        limit: 10,
      });
      expect(result.data).toEqual([]);
    });
  });

  describe('addOrderPayment', () => {
    it('should delegate with orderId and payment input', async () => {
      const order = createMockOrder();
      mocks.addOrderPaymentUseCase.execute.mockResolvedValue(order);

      await service.addOrderPayment('ord-1', {
        paymentMethod: 'CREDIT_CARD',
        amount: 20,
      });

      expect(mocks.addOrderPaymentUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ord-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 20,
      });
    });
  });

  describe('authorizePayment', () => {
    it('should delegate with orderId and transactionId', async () => {
      const order = createMockOrder();
      mocks.authorizePaymentUseCase.execute.mockResolvedValue(order);

      await service.authorizePayment('ord-1', 'txn-123');

      expect(mocks.authorizePaymentUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ord-1',
        transactionId: 'txn-123',
      });
    });
  });

  describe('capturePayment', () => {
    it('should delegate with orderId', async () => {
      const order = createMockOrder();
      mocks.capturePaymentUseCase.execute.mockResolvedValue(order);

      await service.capturePayment('ord-1');

      expect(mocks.capturePaymentUseCase.execute).toHaveBeenCalledWith('ord-1');
    });
  });

  describe('DTO mapping', () => {
    it('should include payment when present', async () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 20,
        paymentStatus: 'PENDING',
        transactionId: null,
        dateCreated: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      const order = createMockOrder({ payment });
      mocks.getOrderByIdUseCase.execute.mockResolvedValue(order);

      const result = await service.getOrderById('ord-1');

      expect(result.payment).toEqual(expect.objectContaining({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 20,
      }));
    });

    it('should return null payment when not present', async () => {
      const order = createMockOrder({ payment: null });
      mocks.getOrderByIdUseCase.execute.mockResolvedValue(order);

      const result = await service.getOrderById('ord-1');

      expect(result.payment).toBeNull();
    });
  });

  describe('error propagation', () => {
    it('should propagate use case errors', async () => {
      mocks.getOrderByIdUseCase.execute.mockRejectedValue(new Error('Not found'));

      await expect(service.getOrderById('nonexistent')).rejects.toThrow('Not found');
    });
  });
});
