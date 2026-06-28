import { SqsLocalService } from './sqs-local.service';
import { UserEventHandlerService } from '../../application/services/user-event-handler.service';

// Mock the AWS SDK SQSClient and commands
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  ReceiveMessageCommand: jest.fn((input) => ({ type: 'ReceiveMessageCommand', input })),
  DeleteMessageCommand: jest.fn((input) => ({ type: 'DeleteMessageCommand', input })),
}));

/**
 * Runs pollQueue for exactly `ticks` setImmediate iterations then stops.
 *
 * The loop's `await new Promise((r) => setImmediate(r))` is outside the inner
 * try/catch.  Throwing inside the Promise executor rejects it, causing the
 * error to propagate out of the while loop.
 */
async function runPollQueueForTicks(
  service: SqsLocalService,
  ticks: number,
): Promise<void> {
  let count = 0;
  const original = global.setImmediate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).setImmediate = (cb: () => void) => {
    count += 1;
    if (count >= ticks) {
      // Throwing synchronously inside the Promise executor rejects the
      // promise, and since we're outside the inner catch block the error
      // propagates all the way out of pollQueue.
      throw new Error('test-stop-loop');
    }
    cb();
    return {} as NodeJS.Immediate;
  };

  try {
    await service.pollQueue();
  } catch (e) {
    if (!(e instanceof Error) || e.message !== 'test-stop-loop') throw e;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setImmediate = original;
  }
}

describe('SqsLocalService', () => {
  let service: SqsLocalService;
  let mockHandler: jest.Mocked<UserEventHandlerService>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      USERS_SQS_QUEUE_URL: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/user-events',
    };

    mockHandler = {
      handleRecords: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UserEventHandlerService>;

    service = new SqsLocalService(mockHandler);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('pollQueue', () => {
    it('throws when USERS_SQS_QUEUE_URL is not set', async () => {
      delete process.env.USERS_SQS_QUEUE_URL;
      service = new SqsLocalService(mockHandler);
      await expect(service.pollQueue()).rejects.toThrow('USERS_SQS_QUEUE_URL is not defined');
    });

    it('processes messages and deletes them after success', async () => {
      mockSend.mockResolvedValueOnce({
        Messages: [{ MessageId: 'msg-1', Body: '{"type":"USER_CREATED"}', ReceiptHandle: 'rh-1' }],
      });
      mockSend.mockResolvedValue({}); // DeleteMessageCommand response

      await runPollQueueForTicks(service, 1);

      expect(mockHandler.handleRecords).toHaveBeenCalledWith([
        expect.objectContaining({ messageId: 'msg-1', body: '{"type":"USER_CREATED"}', receiptHandle: 'rh-1' }),
      ]);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DeleteMessageCommand' }),
      );
    });

    it('does not call handleRecords when no messages are returned', async () => {
      mockSend.mockResolvedValue({ Messages: [] });

      await runPollQueueForTicks(service, 1);

      expect(mockHandler.handleRecords).not.toHaveBeenCalled();
    });

    it('logs errors and continues when receive fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SQS unavailable'));

      await runPollQueueForTicks(service, 1);

      expect(mockHandler.handleRecords).not.toHaveBeenCalled();
    });

    it('handles non-Error exception in receive (string thrown)', async () => {
      // Covers the `String(error)` branch in error logging
      mockSend.mockRejectedValueOnce('plain string error');

      await runPollQueueForTicks(service, 1);

      expect(mockHandler.handleRecords).not.toHaveBeenCalled();
    });

    it('handles message with missing Body and ReceiptHandle', async () => {
      mockSend.mockResolvedValueOnce({
        Messages: [{ MessageId: 'msg-2' }], // no Body or ReceiptHandle
      });
      mockSend.mockResolvedValue({}); // DeleteMessageCommand

      await runPollQueueForTicks(service, 1);

      expect(mockHandler.handleRecords).toHaveBeenCalledWith([
        expect.objectContaining({ body: '', messageId: 'msg-2' }),
      ]);
    });

    it('does not delete message when handler throws', async () => {
      mockSend.mockResolvedValueOnce({
        Messages: [{ MessageId: 'msg-1', Body: '{"type":"USER_DELETED"}', ReceiptHandle: 'rh-1' }],
      });
      mockHandler.handleRecords.mockRejectedValueOnce(new Error('handler error'));

      await runPollQueueForTicks(service, 1);

      const deleteCalls = (mockSend as jest.Mock).mock.calls.filter(
        ([cmd]: [{ type: string }]) => cmd.type === 'DeleteMessageCommand',
      );
      expect(deleteCalls).toHaveLength(0);
    });
  });
});
