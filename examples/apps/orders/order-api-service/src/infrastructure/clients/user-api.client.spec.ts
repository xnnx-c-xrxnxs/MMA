import { UserApiClient } from './user-api.client';
import { runWithRequestContext } from '@old-st/telemetry';
import {
  CustomerNotFoundError,
  CustomerInvalidStatusError,
  CustomerServiceUnavailableError,
} from '@old-st/order-domain';

describe('UserApiClient', () => {
  let client: UserApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_USER_URL = 'http://localhost:3000/api';
    client = new UserApiClient();
  });

  afterEach(() => {
    delete process.env.API_USER_URL;
    globalThis.fetch = originalFetch;
  });

  it('should return validated customer when user is ACTIVE', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'user-1', userStatus: 'ACTIVE', name: 'John' }),
    });

    const result = await client.validate('user-1');

    expect(result).toEqual({ customerId: 'user-1', status: 'ACTIVE' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/user-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should forward Authorization + correlationId from request context', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'user-1', userStatus: 'ACTIVE' }),
    });

    await runWithRequestContext(
      { correlationId: 'corr-xyz', authHeader: 'Bearer test-token' },
      async () => {
        await client.validate('user-1');
      },
    );

    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
    expect(headers['x-correlation-id']).toBe('corr-xyz');
  });

  it('should throw CustomerInvalidStatusError when user is not ACTIVE', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'user-2', userStatus: 'SUSPENDED' }),
    });

    await expect(client.validate('user-2')).rejects.toThrow(
      CustomerInvalidStatusError,
    );
  });

  it('should throw CustomerNotFoundError on 404 response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    await expect(client.validate('user-3')).rejects.toThrow(
      CustomerNotFoundError,
    );
  });

  it('should throw CustomerInvalidStatusError on 409 response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'User is SUSPENDED' }),
    });

    await expect(client.validate('user-4')).rejects.toThrow(
      CustomerInvalidStatusError,
    );
  });

  it('should throw CustomerServiceUnavailableError on 500 response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    });

    await expect(client.validate('user-5')).rejects.toThrow(
      CustomerServiceUnavailableError,
    );
  });

  it('should throw CustomerServiceUnavailableError on network error', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network'));

    await expect(client.validate('user-6')).rejects.toThrow(
      CustomerServiceUnavailableError,
    );
  });
});
