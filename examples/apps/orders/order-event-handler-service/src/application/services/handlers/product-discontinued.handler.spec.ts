import { ProductDiscontinuedHandler } from './product-discontinued.handler';

describe('ProductDiscontinuedHandler', () => {
  let handler: ProductDiscontinuedHandler;
  let mockCancelDraftOrders: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelDraftOrders = { execute: jest.fn() };
    handler = new ProductDiscontinuedHandler(mockCancelDraftOrders as any);
  });

  it('should cancel draft orders for the discontinued product', async () => {
    mockCancelDraftOrders.execute.mockResolvedValue({ cancelledOrderIds: ['ord-1'] });

    await handler.handle(
      { eventType: 'PRODUCT_DISCONTINUED', productId: 'prod-1', occurredAt: '2024-01-01T00:00:00.000Z' } as any,
      'msg-1',
    );

    expect(mockCancelDraftOrders.execute).toHaveBeenCalledWith({ productId: 'prod-1' });
  });

  it('should propagate use case errors', async () => {
    mockCancelDraftOrders.execute.mockRejectedValue(new Error('DB error'));

    await expect(
      handler.handle(
        { eventType: 'PRODUCT_DISCONTINUED', productId: 'prod-1', occurredAt: '2024-01-01T00:00:00.000Z' } as any,
      ),
    ).rejects.toThrow('DB error');
  });
});
