import { apiRequest, apiRequestVoid, setAccessTokenGetter, setOnUnauthorized } from './base-api.client';
import { ApiError } from '../errors/api-error';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: () => Promise.reject(new Error('no body')),
  } as unknown as Response;
}

describe('apiRequest', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should perform GET and return parsed body', async () => {
    const data = { id: '1', name: 'Alice' };
    mockFetch.mockResolvedValue(jsonResponse(data));

    const result = await apiRequest('http://api', '/users/1');

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith('http://api/users/1', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  });

  it('should send POST with JSON body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: '2' }, 201));

    await apiRequest('http://api', '/users', {
      method: 'POST',
      body: { name: 'Bob' },
    });

    expect(mockFetch).toHaveBeenCalledWith('http://api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
      credentials: 'include',
    });
  });

  it('should append query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));

    await apiRequest('http://api', '/users', {
      params: { status: 'ACTIVE', limit: 10, cursor: undefined },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=ACTIVE');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).not.toContain('cursor');
  });

  it('should apply Zod schema when provided', async () => {
    const data = { id: '1', name: 'Alice' };
    mockFetch.mockResolvedValue(jsonResponse(data));
    const schema = { parse: jest.fn((x: unknown) => x) };

    await apiRequest('http://api', '/users/1', { schema: schema as any });

    expect(schema.parse).toHaveBeenCalledWith(data);
  });

  it('should throw ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: 'NotFound', message: 'User not found' }, 404),
    );

    await expect(apiRequest('http://api', '/users/99')).rejects.toThrow(ApiError);

    try {
      await apiRequest('http://api', '/users/99');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(404);
      expect((e as ApiError).error).toBe('NotFound');
    }
  });

  it('should handle 204 No Content as undefined', async () => {
    mockFetch.mockResolvedValue(noContentResponse());

    const result = await apiRequest('http://api', '/healthcheck');

    expect(result).toBeUndefined();
  });
});

describe('apiRequestVoid', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should perform DELETE and return void', async () => {
    mockFetch.mockResolvedValue(noContentResponse());

    await expect(apiRequestVoid('http://api', '/users/1')).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledWith('http://api/users/1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  });

  it('should throw ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: 'ServerError', message: 'Oops' }, 500),
    );

    await expect(apiRequestVoid('http://api', '/users/1')).rejects.toThrow(ApiError);
  });
});

describe('apiRequest — with access token', () => {
  beforeEach(() => mockFetch.mockReset());
  afterEach(() => {
    setAccessTokenGetter(() => null);
    setOnUnauthorized(() => Promise.resolve(false));
  });

  it('should include Authorization header when access token is present', async () => {
    setAccessTokenGetter(() => 'test-token');
    mockFetch.mockResolvedValue(jsonResponse({ id: '1' }));

    await apiRequest('http://api', '/users/1');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api/users/1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('retries request with new token after 401 and successful refresh', async () => {
    let callCount = 0;
    setAccessTokenGetter(() => {
      callCount++;
      return callCount <= 1 ? 'old-token' : 'new-token';
    });
    setOnUnauthorized(jest.fn().mockResolvedValue(true));

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized', message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ id: '1' }));

    const result = await apiRequest('http://api', '/users/1');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: '1' });
    const retryHeaders = (mockFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer new-token');
  });
});

describe('apiRequestVoid — with access token', () => {
  beforeEach(() => mockFetch.mockReset());
  afterEach(() => {
    setAccessTokenGetter(() => null);
  });

  it('should include Authorization header when access token is present', async () => {
    setAccessTokenGetter(() => 'void-token');
    mockFetch.mockResolvedValue(noContentResponse());

    await apiRequestVoid('http://api', '/users/1');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api/users/1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer void-token' }),
      }),
    );
  });
});
