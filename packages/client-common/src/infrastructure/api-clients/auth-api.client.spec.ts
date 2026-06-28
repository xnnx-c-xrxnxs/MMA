jest.mock('./base-api.client', () => ({
  apiRequest: jest.fn(),
}));

import { authApiClient } from './auth-api.client';
import { apiRequest } from './base-api.client';
import { configureApi } from '../config';

const mockApiRequest = apiRequest as jest.Mock;

describe('authApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureApi({ authApiUrl: 'http://test:3003/api' });
  });

  it('signIn → POST /auth/sign-in with email and password', async () => {
    mockApiRequest.mockResolvedValue({ type: 'SUCCESS', tokens: {} });

    await authApiClient.signIn('admin@test.com', 'Password123!');

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/sign-in',
      expect.objectContaining({
        method: 'POST',
        body: { email: 'admin@test.com', password: 'Password123!' },
        schema: expect.anything(),
      }),
    );
  });

  it('completeNewPassword → POST /auth/new-password', async () => {
    mockApiRequest.mockResolvedValue({ accessToken: 'a', idToken: 'i', expiresIn: 3600 });

    await authApiClient.completeNewPassword('admin@test.com', 'NewPass123!', 'session-1');

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/new-password',
      expect.objectContaining({
        method: 'POST',
        body: { email: 'admin@test.com', newPassword: 'NewPass123!', session: 'session-1' },
      }),
    );
  });

  it('refreshSession → POST /auth/refresh-session with no body', async () => {
    mockApiRequest.mockResolvedValue({ accessToken: 'a', idToken: 'i', expiresIn: 3600 });

    await authApiClient.refreshSession();

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/refresh-session',
      expect.objectContaining({ method: 'POST' }),
    );
    const callArgs = mockApiRequest.mock.calls[0][2];
    expect(callArgs.body).toBeUndefined();
  });

  it('forgotPassword → POST /auth/forgot-password', async () => {
    mockApiRequest.mockResolvedValue({ message: 'sent' });

    await authApiClient.forgotPassword('admin@test.com');

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/forgot-password',
      expect.objectContaining({ method: 'POST', body: { email: 'admin@test.com' } }),
    );
  });

  it('confirmForgotPassword → POST /auth/confirm-forgot-password', async () => {
    mockApiRequest.mockResolvedValue({ message: 'reset' });

    await authApiClient.confirmForgotPassword('admin@test.com', '123456', 'NewPass123!');

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/confirm-forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: { email: 'admin@test.com', code: '123456', newPassword: 'NewPass123!' },
      }),
    );
  });

  it('changePassword → POST /auth/change-password', async () => {
    mockApiRequest.mockResolvedValue({ message: 'changed' });

    await authApiClient.changePassword('OldPass123!', 'NewPass123!');

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: { oldPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      }),
    );
  });

  it('signOut → POST /auth/sign-out with no body', async () => {
    mockApiRequest.mockResolvedValue({ message: 'signed out' });

    await authApiClient.signOut();

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
    const callArgs = mockApiRequest.mock.calls[0][2];
    expect(callArgs.body).toBeUndefined();
  });

  it('me → GET /auth/me', async () => {
    mockApiRequest.mockResolvedValue({ userId: 'u-1', email: 'admin@test.com', userRole: 'ADMIN' });

    await authApiClient.me();

    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3003/api',
      '/auth/me',
      expect.objectContaining({ schema: expect.anything() }),
    );
    const callArgs = mockApiRequest.mock.calls[0][2];
    expect(callArgs.method).toBeUndefined(); // defaults to GET
  });
});
