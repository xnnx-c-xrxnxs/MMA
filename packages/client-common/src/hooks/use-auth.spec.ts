jest.mock('../infrastructure/api-clients/auth-api.client', () => ({
  authApiClient: {
    signIn: jest.fn(),
    completeNewPassword: jest.fn(),
    refreshSession: jest.fn(),
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    changePassword: jest.fn(),
    signOut: jest.fn(),
    me: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useSignIn,
  useCompleteNewPassword,
  useRefreshSession,
  useForgotPassword,
  useConfirmForgotPassword,
  useChangePassword,
  useSignOut,
  useCurrentUser,
} from './use-auth';
import { authApiClient } from '../infrastructure/api-clients/auth-api.client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const MOCK_TOKENS = { accessToken: 'access', idToken: 'id', expiresIn: 3600 };

describe('use-auth hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useSignIn', () => {
    it('should call authApiClient.signIn with email and password', async () => {
      (authApiClient.signIn as jest.Mock).mockResolvedValue({ type: 'SUCCESS', tokens: MOCK_TOKENS });

      const { result } = renderHook(() => useSignIn(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({ email: 'admin@test.com', password: 'Password123!' });
      });

      expect(authApiClient.signIn).toHaveBeenCalledWith('admin@test.com', 'Password123!');
    });
  });

  describe('useCompleteNewPassword', () => {
    it('should call authApiClient.completeNewPassword', async () => {
      (authApiClient.completeNewPassword as jest.Mock).mockResolvedValue(MOCK_TOKENS);

      const { result } = renderHook(() => useCompleteNewPassword(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'admin@test.com',
          newPassword: 'NewPass123!',
          session: 'session-abc',
        });
      });

      expect(authApiClient.completeNewPassword).toHaveBeenCalledWith(
        'admin@test.com',
        'NewPass123!',
        'session-abc',
      );
    });
  });

  describe('useRefreshSession', () => {
    it('should call authApiClient.refreshSession', async () => {
      (authApiClient.refreshSession as jest.Mock).mockResolvedValue(MOCK_TOKENS);

      const { result } = renderHook(() => useRefreshSession(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(authApiClient.refreshSession).toHaveBeenCalled();
    });
  });

  describe('useForgotPassword', () => {
    it('should call authApiClient.forgotPassword with email', async () => {
      (authApiClient.forgotPassword as jest.Mock).mockResolvedValue({ message: 'sent' });

      const { result } = renderHook(() => useForgotPassword(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({ email: 'admin@test.com' });
      });

      expect(authApiClient.forgotPassword).toHaveBeenCalledWith('admin@test.com');
    });
  });

  describe('useConfirmForgotPassword', () => {
    it('should call authApiClient.confirmForgotPassword', async () => {
      (authApiClient.confirmForgotPassword as jest.Mock).mockResolvedValue({ message: 'reset' });

      const { result } = renderHook(() => useConfirmForgotPassword(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'admin@test.com',
          code: '123456',
          newPassword: 'NewPass123!',
        });
      });

      expect(authApiClient.confirmForgotPassword).toHaveBeenCalledWith(
        'admin@test.com',
        '123456',
        'NewPass123!',
      );
    });
  });

  describe('useChangePassword', () => {
    it('should call authApiClient.changePassword', async () => {
      (authApiClient.changePassword as jest.Mock).mockResolvedValue({ message: 'changed' });

      const { result } = renderHook(() => useChangePassword(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({ oldPassword: 'OldPass123!', newPassword: 'NewPass123!' });
      });

      expect(authApiClient.changePassword).toHaveBeenCalledWith('OldPass123!', 'NewPass123!');
    });
  });

  describe('useSignOut', () => {
    it('should call authApiClient.signOut', async () => {
      (authApiClient.signOut as jest.Mock).mockResolvedValue({ message: 'signed out' });

      const { result } = renderHook(() => useSignOut(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(authApiClient.signOut).toHaveBeenCalled();
    });
  });

  describe('useCurrentUser', () => {
    it('should fetch current user from /auth/me', async () => {
      const mockUser = { userId: 'u-1', email: 'admin@test.com', userRole: 'ADMIN' };
      (authApiClient.me as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockUser);
      expect(authApiClient.me).toHaveBeenCalled();
    });

    it('should not retry on failure (retry: false)', async () => {
      (authApiClient.me as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      // Should only be called once — no retries
      expect(authApiClient.me).toHaveBeenCalledTimes(1);
    });
  });
});
