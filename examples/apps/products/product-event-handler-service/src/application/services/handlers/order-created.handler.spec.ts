import { OrderCreatedHandler } from './order-created.handler';
import { Product } from '@old-st/product-domain';

function createMockProduct(overrides: Partial<Record<string, unknown>> = {}): Product {
  return Product.reconstitute({
    productId: 'prod-1',
    name: 'Widget',
    description: 'A widget',
    categoryId: 'cat-1',
    price: 10,
    inventory: 100,
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });
}

describe('OrderCreatedHandler', () => {
  let handler: OrderCreatedHandler;
  let mockCheckAvailability: { execute: jest.Mock };
  let mockResultPublisher: { publish: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAvailability = { execute: jest.fn() };
    mockResultPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    handler = new OrderCreatedHandler(
      mockCheckAvailability as any,
      mockResultPublisher as any,
    );
  });

  it('should publish PRODUCT_VALIDATION_SUCCEEDED when all products valid', async () => {
    const product = createMockProduct({ productId: 'prod-1', price: 10, status: 'ACTIVE' });
    mockCheckAvailability.execute.mockResolvedValue([product]);

    await handler.handle(
      {
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 2, price: 10 }],
        totalAmount: 20,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-1',
    );

    expect(mockResultPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRODUCT_VALIDATION_SUCCEEDED',
        orderId: 'ord-1',
      }),
    );
  });

  it('should publish PRODUCT_VALIDATION_FAILED when product not found', async () => {
    mockCheckAvailability.execute.mockResolvedValue([]);

    await handler.handle(
      {
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [{ productId: 'prod-missing', productName: 'X', quantity: 1, price: 10 }],
        totalAmount: 10,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-2',
    );

    expect(mockResultPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRODUCT_VALIDATION_FAILED',
        orderId: 'ord-1',
      }),
    );
  });

  it('should publish PRODUCT_VALIDATION_FAILED when product is not active', async () => {
    const product = createMockProduct({ productId: 'prod-1', status: 'INACTIVE' });
    mockCheckAvailability.execute.mockResolvedValue([product]);

    await handler.handle(
      {
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 1, price: 10 }],
        totalAmount: 10,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-3',
    );

    expect(mockResultPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRODUCT_VALIDATION_FAILED',
      }),
    );
  });

  it('should publish PRODUCT_VALIDATION_FAILED when price mismatch', async () => {
    const product = createMockProduct({ productId: 'prod-1', price: 15, status: 'ACTIVE' });
    mockCheckAvailability.execute.mockResolvedValue([product]);

    await handler.handle(
      {
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 1, price: 10 }],
        totalAmount: 10,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-4',
    );

    expect(mockResultPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRODUCT_VALIDATION_FAILED',
      }),
    );
  });

  it('should publish PRODUCT_VALIDATION_FAILED when availability check throws', async () => {
    mockCheckAvailability.execute.mockRejectedValue(new Error('DB error'));

    await handler.handle(
      {
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', productName: 'Widget', quantity: 1, price: 10 }],
        totalAmount: 10,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-5',
    );

    expect(mockResultPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRODUCT_VALIDATION_FAILED',
        orderId: 'ord-1',
      }),
    );
  });
});
