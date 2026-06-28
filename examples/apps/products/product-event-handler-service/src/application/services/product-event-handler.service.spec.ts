import { ProductEventHandlerService } from './product-event-handler.service';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';

jest.mock('@old-st/contracts/order', () => {
  const actual = jest.requireActual('@old-st/contracts/order');
  return {
    ...actual,
    orderDomainEventSchema: {
      safeParse: jest.fn((data: unknown) => ({ success: true, data })),
    },
  };
});

import { orderDomainEventSchema } from '@old-st/contracts/order';

describe('ProductEventHandlerService', () => {
  let service: ProductEventHandlerService;
  let mockOrderCreatedHandler: { handle: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderCreatedHandler = { handle: jest.fn().mockResolvedValue(undefined) };
    service = new ProductEventHandlerService(mockOrderCreatedHandler as any);
  });

  it('should dispatch ORDER_CREATED events to orderCreatedHandler', async () => {
    const record: NormalizedSqsRecord = {
      body: JSON.stringify({
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        customerId: 'cust-1',
        items: [],
      }),
      messageId: 'msg-1',
    };

    await service.handleRecords([record]);

    expect(mockOrderCreatedHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ORDER_CREATED', orderId: 'ord-1' }),
      'msg-1',
    );
  });

  it('should skip records with invalid event shape', async () => {
    (orderDomainEventSchema.safeParse as jest.Mock).mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'invalid' }] },
    });

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ bad: 'data' }),
      messageId: 'msg-2',
    };

    await service.handleRecords([record]);

    expect(mockOrderCreatedHandler.handle).not.toHaveBeenCalled();
  });

  it('should log warning for unhandled event types', async () => {
    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'UNKNOWN_EVENT' }),
      messageId: 'msg-3',
    };

    await service.handleRecords([record]);

    expect(mockOrderCreatedHandler.handle).not.toHaveBeenCalled();
  });

  it('should propagate handler errors', async () => {
    mockOrderCreatedHandler.handle.mockRejectedValue(new Error('Handler failed'));

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({
        eventType: 'ORDER_CREATED',
        orderId: 'ord-1',
        items: [],
      }),
      messageId: 'msg-4',
    };

    await expect(service.handleRecords([record])).rejects.toThrow('Handler failed');
  });
});
