import { ProductPriceChangedHandler } from './product-price-changed.handler';

describe('ProductPriceChangedHandler', () => {
  let handler: ProductPriceChangedHandler;
  let mockUpdateItemLatestPrice: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateItemLatestPrice = { execute: jest.fn() };
    handler = new ProductPriceChangedHandler(mockUpdateItemLatestPrice as any);
  });

  it('should update item latest price for the product', async () => {
    mockUpdateItemLatestPrice.execute.mockResolvedValue({ updatedOrderIds: ['ord-1'] });

    await handler.handle(
      {
        eventType: 'PRODUCT_PRICE_CHANGED',
        productId: 'prod-1',
        oldPrice: 10,
        newPrice: 15,
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-1',
    );

    expect(mockUpdateItemLatestPrice.execute).toHaveBeenCalledWith({
      productId: 'prod-1',
      newPrice: 15,
    });
  });

  it('should propagate use case errors', async () => {
    mockUpdateItemLatestPrice.execute.mockRejectedValue(new Error('DB error'));

    await expect(
      handler.handle(
        {
          eventType: 'PRODUCT_PRICE_CHANGED',
          productId: 'prod-1',
          oldPrice: 10,
          newPrice: 15,
          occurredAt: '2024-01-01T00:00:00.000Z',
        } as any,
      ),
    ).rejects.toThrow('DB error');
  });
});
