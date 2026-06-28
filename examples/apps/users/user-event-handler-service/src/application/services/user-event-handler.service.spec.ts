import { UserEventHandlerService } from './user-event-handler.service';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';

jest.mock('@old-st/contracts/user', () => {
  const actual = jest.requireActual('@old-st/contracts/user');
  return {
    ...actual,
    userDomainEventSchema: {
      safeParse: jest.fn((data: unknown) => ({ success: true, data })),
    },
  };
});

import { userDomainEventSchema } from '@old-st/contracts/user';

describe('UserEventHandlerService', () => {
  let service: UserEventHandlerService;
  let mockUserDeletedHandler: { handle: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserDeletedHandler = { handle: jest.fn().mockResolvedValue(undefined) };
    service = new UserEventHandlerService(mockUserDeletedHandler as any);
  });

  it('should dispatch USER_DELETED events to userDeletedHandler', async () => {
    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'USER_DELETED', userId: 'u1' }),
      messageId: 'msg-1',
    };

    await service.handleRecords([record]);

    expect(mockUserDeletedHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'USER_DELETED', userId: 'u1' }),
      'msg-1',
    );
  });

  it('should log warning for unhandled event types', async () => {
    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'UNKNOWN_EVENT' }),
      messageId: 'msg-2',
    };

    // Should not throw
    await service.handleRecords([record]);

    expect(mockUserDeletedHandler.handle).not.toHaveBeenCalled();
  });

  it('should skip records with invalid event shape', async () => {
    (userDomainEventSchema.safeParse as jest.Mock).mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'invalid' }] },
    });

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ bad: 'data' }),
      messageId: 'msg-3',
    };

    await service.handleRecords([record]);

    expect(mockUserDeletedHandler.handle).not.toHaveBeenCalled();
  });

  it('should propagate handler errors', async () => {
    mockUserDeletedHandler.handle.mockRejectedValue(new Error('Handler failed'));

    const record: NormalizedSqsRecord = {
      body: JSON.stringify({ eventType: 'USER_DELETED', userId: 'u1' }),
      messageId: 'msg-4',
    };

    await expect(service.handleRecords([record])).rejects.toThrow('Handler failed');
  });

  it('should process multiple records sequentially', async () => {
    const records: NormalizedSqsRecord[] = [
      { body: JSON.stringify({ eventType: 'USER_DELETED', userId: 'u1' }), messageId: 'msg-1' },
      { body: JSON.stringify({ eventType: 'USER_DELETED', userId: 'u2' }), messageId: 'msg-2' },
    ];

    await service.handleRecords(records);

    expect(mockUserDeletedHandler.handle).toHaveBeenCalledTimes(2);
  });
});
