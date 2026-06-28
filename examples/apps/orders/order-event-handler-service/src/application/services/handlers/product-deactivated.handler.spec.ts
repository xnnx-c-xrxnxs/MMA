import { ProductDeactivatedHandler } from './product-deactivated.handler';

describe('ProductDeactivatedHandler', () => {
  let handler: ProductDeactivatedHandler;
  let mockCancelDraftOrders: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelDraftOrders = { execute: jest.fn() };
    handler = new ProductDeactivatedHandler(mockCancelDraftOrders as any);
  });

  it('should cancel draft orders for the deactivated product', async () => {
    mockCancelDraftOrders.execute.mockResolvedValue({ cancelledOrderIds: ['ord-1', 'ord-2'] });

    await handler.handle(
      { eventType: 'PRODUCT_DEACTIVATED', productId: 'prod-1', occurredAt: '2024-01-01T00:00:00.000Z' } as any,
      'msg-1',
    );

    expect(mockCancelDraftOrders.execute).toHaveBeenCalledWith({ productId: 'prod-1' });
  });

  it('should propagate use case errors', async () => {
    mockCancelDraftOrders.execute.mockRejectedValue(new Error('DB error'));

    await expect(
      handler.handle(
        { eventType: 'PRODUCT_DEACTIVATED', productId: 'prod-1', occurredAt: '2024-01-01T00:00:00.000Z' } as any,
        'msg-2',
      ),
    ).rejects.toThrow('DB error');
  });
});
