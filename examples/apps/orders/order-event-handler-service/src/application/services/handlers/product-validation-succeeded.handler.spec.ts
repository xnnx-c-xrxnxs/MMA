import { ProductValidationSucceededHandler } from './product-validation-succeeded.handler';

describe('ProductValidationSucceededHandler', () => {
  let handler: ProductValidationSucceededHandler;
  let mockApproveProductValidation: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApproveProductValidation = { execute: jest.fn() };
    handler = new ProductValidationSucceededHandler(
      mockApproveProductValidation as any,
    );
  });

  it('should approve product validation for the order', async () => {
    mockApproveProductValidation.execute.mockResolvedValue(undefined);

    await handler.handle(
      {
        eventType: 'PRODUCT_VALIDATION_SUCCEEDED',
        orderId: 'ord-1',
        occurredAt: '2024-01-01T00:00:00.000Z',
      } as any,
      'msg-1',
    );

    expect(mockApproveProductValidation.execute).toHaveBeenCalledWith('ord-1');
  });

  it('should swallow CannotApproveProductValidationError for idempotency', async () => {
    const error = new Error('Order is not in DRAFT status');
    error.name = 'CannotApproveProductValidationError';
    mockApproveProductValidation.execute.mockRejectedValue(error);

    // Should NOT throw — idempotency guard catches it
    await expect(
      handler.handle(
        {
          eventType: 'PRODUCT_VALIDATION_SUCCEEDED',
          orderId: 'ord-1',
          occurredAt: '2024-01-01T00:00:00.000Z',
        } as any,
        'msg-2',
      ),
    ).resolves.toBeUndefined();
  });

  it('should rethrow non-idempotent errors', async () => {
    mockApproveProductValidation.execute.mockRejectedValue(
      new Error('DB failure'),
    );

    await expect(
      handler.handle(
        {
          eventType: 'PRODUCT_VALIDATION_SUCCEEDED',
          orderId: 'ord-1',
          occurredAt: '2024-01-01T00:00:00.000Z',
        } as any,
      ),
    ).rejects.toThrow('DB failure');
  });
});
