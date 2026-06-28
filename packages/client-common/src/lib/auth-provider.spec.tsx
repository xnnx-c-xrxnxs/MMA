jest.mock('../infrastructure/api-clients/auth-api.client', () => ({
  authApiClient: {
    signIn: jest.fn(),
    completeNewPassword: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    me: jest.fn(),
  },
}));

jest.mock('../infrastructure/api-clients/base-api.client', () => ({
  apiRequest: jest.fn(),
  apiRequestVoid: jest.fn(),
  setAccessTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from './auth-provider';
import { authApiClient } from '../infrastructure/api-clients/auth-api.client';
import {
  setAccessTokenGetter,
  setOnUnauthorized,
} from '../infrastructure/api-clients/base-api.client';

// Build a valid mock JWT with a base64-encoded JSON payload
function buildMockIdToken(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}

const MOCK_USER_PAYLOAD = {
  'custom:userId': 'user-1',
  email: 'test@test.com',
  'custom:userRole': 'USER',
};

const MOCK_TOKENS = {
  accessToken: 'mock-access-token',
  idToken: buildMockIdToken(MOCK_USER_PAYLOAD),
  expiresIn: 3600,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: silentRefresh fails (unauthenticated state)
    (authApiClient.refreshSession as jest.Mock).mockRejectedValue(new Error('unauthorized'));
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => void 0);
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
    spy.mockRestore();
  });

  it('registers setAccessTokenGetter and setOnUnauthorized on mount', async () => {
    renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(setAccessTokenGetter).toHaveBeenCalled());
    expect(setOnUnauthorized).toHaveBeenCalled();
  });

  it('starts as loading and sets isLoading=false after silentRefresh resolves', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('provides isAuthenticated=false and user=null when not signed in', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  describe('silentRefresh (on mount)', () => {
    it('sets user and isAuthenticated=true when refreshSession succeeds', async () => {
      (authApiClient.refreshSession as jest.Mock).mockResolvedValue(MOCK_TOKENS);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({
        userId: 'user-1',
        email: 'test@test.com',
        userRole: 'USER',
      });
    });

    it('keeps user=null when refreshSession fails', async () => {
      (authApiClient.refreshSession as jest.Mock).mockRejectedValue(new Error('expired'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('signIn', () => {
    it('stores tokens and sets user when result type is SUCCESS', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (authApiClient.signIn as jest.Mock).mockResolvedValue({
        type: 'SUCCESS',
        tokens: MOCK_TOKENS,
      });

      await act(async () => {
        await result.current.signIn('test@test.com', 'Password123!');
      });

      expect(result.current.user).toEqual({
        userId: 'user-1',
        email: 'test@test.com',
        userRole: 'USER',
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('does not store tokens when result type is not SUCCESS', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (authApiClient.signIn as jest.Mock).mockResolvedValue({
        type: 'NEW_PASSWORD_REQUIRED',
        session: 'sess-123',
      });

      await act(async () => {
        await result.current.signIn('test@test.com', 'Password123!');
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('completeNewPassword', () => {
    it('stores tokens and sets user on success', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (authApiClient.completeNewPassword as jest.Mock).mockResolvedValue(MOCK_TOKENS);

      await act(async () => {
        await result.current.completeNewPassword('test@test.com', 'NewPass1!', 'session-x');
      });

      expect(result.current.user).toEqual({
        userId: 'user-1',
        email: 'test@test.com',
        userRole: 'USER',
      });
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('signOut', () => {
    async function signInFirst(result: ReturnType<typeof renderHook<ReturnType<typeof useAuth>, unknown>>['result']) {
      (authApiClient.signIn as jest.Mock).mockResolvedValue({ type: 'SUCCESS', tokens: MOCK_TOKENS });
      await act(async () => {
        await result.current.signIn('test@test.com', 'Password123!');
      });
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    }

    it('clears user and isAuthenticated after signOut', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await signInFirst(result);

      (authApiClient.signOut as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('still clears user when signOut API call fails', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await signInFirst(result);

      (authApiClient.signOut as jest.Mock).mockRejectedValue(new Error('network error'));

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('storeTokens — JWT decode fallback', () => {
    // An idToken with 3 parts but a middle segment that is valid base64
    // yet decodes to non-JSON → JSON.parse throws → catch fires → me() is called
    const invalidJsonToken = `header.${btoa('not-json')}.signature`;

    it('calls me() and sets user when idToken payload is not valid JSON', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const badTokens = { accessToken: 'access', idToken: invalidJsonToken, expiresIn: 3600 };
      (authApiClient.signIn as jest.Mock).mockResolvedValue({ type: 'SUCCESS', tokens: badTokens });
      (authApiClient.me as jest.Mock).mockResolvedValue({
        userId: 'me-user',
        email: 'me@test.com',
        userRole: 'ADMIN',
      });

      await act(async () => {
        await result.current.signIn('me@test.com', 'Password123!');
      });

      await waitFor(() =>
        expect(result.current.user).toEqual({
          userId: 'me-user',
          email: 'me@test.com',
          userRole: 'ADMIN',
        }),
      );
    });

    it('keeps user as null when idToken is invalid and me() also fails', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const badTokens = { accessToken: 'access', idToken: invalidJsonToken, expiresIn: 3600 };
      (authApiClient.signIn as jest.Mock).mockResolvedValue({ type: 'SUCCESS', tokens: badTokens });
      (authApiClient.me as jest.Mock).mockRejectedValue(new Error('me failed'));

      await act(async () => {
        await result.current.signIn('fail@test.com', 'Password123!');
      });

      // me() rejects → catch(() => setUser(null)) — user remains null
      await waitFor(() => expect(result.current.user).toBeNull());
    });
  });
});
