import { ProductValidationFailedHandler } from './product-validation-failed.handler';

describe('ProductValidationFailedHandler', () => {
  let handler: ProductValidationFailedHandler;
  let mockFailOrderValidation: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFailOrderValidation = { execute: jest.fn() };
    handler = new ProductValidationFailedHandler(
      mockFailOrderValidation as any,
    );
  });

  it('should fail order validation for the order', async () => {
    mockFailOrderValidation.execute.mockResolvedValue(undefined);

    await handler.handle(
      {
        eventType: 'PRODUCT_VALIDATION_FAILED',
        orderId: 'ord-1',
        reason: 'Product not found',
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-1',
    );

    expect(mockFailOrderValidation.execute).toHaveBeenCalledWith('ord-1');
  });

  it('should swallow CannotFailValidationError for idempotency', async () => {
    const error = new Error('Order is not in DRAFT status');
    error.name = 'CannotFailValidationError';
    mockFailOrderValidation.execute.mockRejectedValue(error);

    // Should NOT throw — idempotency guard catches it
    await expect(
      handler.handle(
        {
          eventType: 'PRODUCT_VALIDATION_FAILED',
          orderId: 'ord-1',
          reason: 'Product not found',
          occurredAt: '2024-01-01T00:00:00.000Z',
        } as any,
        'msg-2',
      ),
    ).resolves.toBeUndefined();
  });

  it('should rethrow non-idempotent errors', async () => {
    mockFailOrderValidation.execute.mockRejectedValue(
      new Error('DB failure'),
    );

    await expect(
      handler.handle(
        {
          eventType: 'PRODUCT_VALIDATION_FAILED',
          orderId: 'ord-1',
          reason: 'Product not found',
          occurredAt: '2024-01-01T00:00:00.000Z',
        } as any,
      ),
    ).rejects.toThrow('DB failure');
  });
});
