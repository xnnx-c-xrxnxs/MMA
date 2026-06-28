import { OrderEventHandlerService } from './order-event-handler.service';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';

jest.mock('@old-st/contracts/product', () => {
  const actual = jest.requireActual('@old-st/contracts/product');
  return {
    ...actual,
    productDomainEventSchema: {
      safeParse: jest.fn((data: unknown) => ({ success: true, data })),
    },
  };
});

import { productDomainEventSchema } from '@old-st/contracts/product';

describe('OrderEventHandlerService', () => {
  let service: OrderEventHandlerService;
  let handlers: Record<string, { handle: jest.Mock }>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {
      productDeactivated: { handle: jest.fn().mockResolvedValue(undefined) },
      productDiscontinued: { handle: jest.fn().mockResolvedValue(undefined) },
      productDeleted: { handle: jest.fn().mockResolvedValue(undefined) },
      productPriceChanged: { handle: jest.fn().mockResolvedValue(undefined) },
      productValidationSucceeded: { handle: jest.fn().mockResolvedValue(undefined) },
      productValidationFailed: { handle: jest.fn().mockResolvedValue(undefined) },
    };
    service = new OrderEventHandlerService(
      handlers.productDeactivated as any,
      handlers.productDiscontinued as any,
      handlers.productDeleted as any,
      handlers.productPriceChanged as any,
      handlers.productValidationSucceeded as any,
      handlers.productValidationFailed as any,
    );
  });

  const eventHandlerMapping = [
    { eventType: 'PRODUCT_DEACTIVATED', handler: 'productDeactivated' },
    { eventType: 'PRODUCT_DISCONTINUED', handler: 'productDiscontinued' },
    { eventType: 'PRODUCT_DELETED', handler: 'productDeleted' },
    { eventType: 'PRODUCT_PRICE_CHANGED', handler: 'productPriceChanged' },
    { eventType: 'PRODUCT_VALIDATION_SUCCEEDED', handler: 'productValidationSucceeded' },
    { eventType: 'PRODUCT_VALIDATION_FAILED', handler: 'productValidationFailed' },
  ];

  eventHandlerMapping.forEach(({ eventType, handler }) => {
    it(`should dispatch ${eventType} to ${handler} handler`, async () => {
      const record: NormalizedSqsRecord = {
        body: JSON.stringify({ eventType, productId: 'prod-1' }),
        messageId: 'msg-1',
      };

      await service.handleRecords([record]);

      expect(handlers[handler].handle).toHaveBeenCalledWith(
        expect.objectContaining({ eventType }),
        'msg-1',
      );
    });
  });

  it('should skip records with invalid event shape', async () => {
    (productDomainEventSchema.safeParse as jest.Mock).mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'invalid' }] },
    });

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ bad: 'data' }),
      messageId: 'msg-2',
    };

    await service.handleRecords([record]);

    Object.values(handlers).forEach((h) => {
      expect(h.handle).not.toHaveBeenCalled();
    });
  });

  it('should log warning for unhandled event types', async () => {
    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'UNKNOWN_EVENT' }),
      messageId: 'msg-3',
    };

    await service.handleRecords([record]);

    Object.values(handlers).forEach((h) => {
      expect(h.handle).not.toHaveBeenCalled();
    });
  });

  it('should propagate handler errors', async () => {
    handlers.productDeactivated.handle.mockRejectedValue(new Error('Handler failed'));

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'PRODUCT_DEACTIVATED', productId: 'p1' }),
      messageId: 'msg-4',
    };

    await expect(service.handleRecords([record])).rejects.toThrow('Handler failed');
  });

  it('should process multiple records sequentially', async () => {
    const records: NormalizedSqsRecord[] = [
      { body: JSON.stringify({ eventType: 'PRODUCT_DEACTIVATED', productId: 'p1' }), messageId: 'm1' },
      { body: JSON.stringify({ eventType: 'PRODUCT_DELETED', productId: 'p2' }), messageId: 'm2' },
    ];

    await service.handleRecords(records);

    expect(handlers.productDeactivated.handle).toHaveBeenCalledTimes(1);
    expect(handlers.productDeleted.handle).toHaveBeenCalledTimes(1);
  });
});
