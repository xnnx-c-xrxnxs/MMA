import { UserDeletedHandler } from './user-deleted.handler';

describe('UserDeletedHandler', () => {
  let handler: UserDeletedHandler;

  beforeEach(() => {
    handler = new UserDeletedHandler();
  });

  it('should handle USER_DELETED event without throwing', async () => {
    await expect(
      handler.handle(
        { eventType: 'USER_DELETED', userId: 'u1', email: 'test@example.com' } as any,
        'msg-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('should handle missing messageId gracefully', async () => {
    await expect(
      handler.handle(
        { eventType: 'USER_DELETED', userId: 'u1' } as any,
      ),
    ).resolves.toBeUndefined();
  });
});
