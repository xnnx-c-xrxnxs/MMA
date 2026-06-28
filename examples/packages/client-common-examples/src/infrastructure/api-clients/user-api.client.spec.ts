jest.mock('./base-api.client', () => ({
  apiRequest: jest.fn(),
  apiRequestVoid: jest.fn(),
}));

import { userApiClient } from './user-api.client';
import { apiRequest, apiRequestVoid } from './base-api.client';
import { configureApi } from '../config';

const mockApiRequest = apiRequest as jest.Mock;
const mockApiRequestVoid = apiRequestVoid as jest.Mock;

describe('userApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureApi({ userApiUrl: 'http://test:3000/api' });
  });

  it('create → POST /users', async () => {
    const input = { email: 'a@b.com', firstName: 'A', lastName: 'B', userRole: 'USER' };
    mockApiRequest.mockResolvedValue({ userId: '1' });

    await userApiClient.create(input as any);

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users',
      expect.objectContaining({ method: 'POST', body: input }),
    );
  });

  it('getById → GET /users/:id', async () => {
    mockApiRequest.mockResolvedValue({ userId: '1' });
    await userApiClient.getById('usr-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users/usr-1',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('getByEmail → GET /users?email=', async () => {
    mockApiRequest.mockResolvedValue({ userId: '1' });
    await userApiClient.getByEmail('a@b.com');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users',
      expect.objectContaining({ params: { email: 'a@b.com' } }),
    );
  });

  it('listByStatus → GET /users/by-status', async () => {
    mockApiRequest.mockResolvedValue({ items: [] });
    await userApiClient.listByStatus({ userStatus: 'ACTIVE' });
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users/by-status',
      expect.objectContaining({ params: expect.objectContaining({ userStatus: 'ACTIVE' }) }),
    );
  });

  it('delete → DELETE /users/:id', async () => {
    mockApiRequestVoid.mockResolvedValue(undefined);
    await userApiClient.delete('usr-1');
    expect(mockApiRequestVoid).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users/usr-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('activate → POST /users/:id/activate', async () => {
    mockApiRequest.mockResolvedValue({ userId: '1' });
    await userApiClient.activate('usr-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users/usr-1/activate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateRole → PATCH /users/:id/role', async () => {
    mockApiRequest.mockResolvedValue({ userId: '1' });
    await userApiClient.updateRole('usr-1', { userRole: 'ADMIN' } as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3000/api',
      '/users/usr-1/role',
      expect.objectContaining({ method: 'PATCH', body: { userRole: 'ADMIN' } }),
    );
  });
});
