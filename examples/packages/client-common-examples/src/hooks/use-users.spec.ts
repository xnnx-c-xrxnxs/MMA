jest.mock('../infrastructure/api-clients/user-api.client', () => ({
  userApiClient: {
    getById: jest.fn(),
    listByStatus: jest.fn(),
    listByRoleAndStatus: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    delete: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
    verifyEmail: jest.fn(),
    updateRole: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUser,
  useUsersByStatus,
  useUsersByRoleAndStatus,
  useCreateUser,
  useUpdateUserProfile,
  useDeleteUser,
  useActivateUser,
  useDeactivateUser,
  useVerifyUserEmail,
  useUpdateUserRole,
} from './use-users';
import { userApiClient } from '../infrastructure/api-clients/user-api.client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('use-users hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useUser', () => {
    it('should fetch user by id', async () => {
      (userApiClient.getById as jest.Mock).mockResolvedValue({ userId: 'u1', firstName: 'A' });
      const { result } = renderHook(() => useUser('u1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ userId: 'u1', firstName: 'A' });
    });

    it('should not fetch when userId is empty', () => {
      const { result } = renderHook(() => useUser(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useUsersByStatus', () => {
    it('should fetch users by status', async () => {
      const page = { items: [{ userId: 'u1' }], nextCursorPointer: null, prevCursorPointer: null };
      (userApiClient.listByStatus as jest.Mock).mockResolvedValue(page);
      const { result } = renderHook(
        () => useUsersByStatus({ userStatus: 'ACTIVE' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(page);
    });
  });

  describe('useCreateUser', () => {
    it('should call create and invalidate cache', async () => {
      (userApiClient.create as jest.Mock).mockResolvedValue({ userId: 'u2' });
      const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ email: 'b@c.com', firstName: 'B', lastName: 'C', userRole: 'USER' } as any);
      });
      expect(userApiClient.create).toHaveBeenCalled();
    });
  });

  describe('useDeleteUser', () => {
    it('should call delete', async () => {
      (userApiClient.delete as jest.Mock).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteUser(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('u1');
      });
      expect(userApiClient.delete).toHaveBeenCalledWith('u1');
    });
  });

  describe('useActivateUser', () => {
    it('should call activate', async () => {
      (userApiClient.activate as jest.Mock).mockResolvedValue({ userId: 'u1' });
      const { result } = renderHook(() => useActivateUser(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('u1');
      });
      expect(userApiClient.activate).toHaveBeenCalledWith('u1');
    });
  });

  describe('useVerifyUserEmail', () => {
    it('should call verifyEmail', async () => {
      (userApiClient.verifyEmail as jest.Mock).mockResolvedValue({ userId: 'u1' });
      const { result } = renderHook(() => useVerifyUserEmail(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('u1');
      });
      expect(userApiClient.verifyEmail).toHaveBeenCalledWith('u1');
    });
  });

  describe('useUpdateUserRole', () => {
    it('should call updateRole', async () => {
      (userApiClient.updateRole as jest.Mock).mockResolvedValue({ userId: 'u1' });
      const { result } = renderHook(() => useUpdateUserRole(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ userId: 'u1', data: { userRole: 'ADMIN' } } as any);
      });
      expect(userApiClient.updateRole).toHaveBeenCalledWith('u1', { userRole: 'ADMIN' });
    });
  });

  describe('useUsersByRoleAndStatus', () => {
    it('should fetch users by role and status', async () => {
      const page = { items: [{ userId: 'u1' }], nextCursorPointer: null, prevCursorPointer: null };
      (userApiClient.listByRoleAndStatus as jest.Mock).mockResolvedValue(page);
      const { result } = renderHook(
        () => useUsersByRoleAndStatus({ userRole: 'USER', userStatus: 'ACTIVE' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(page);
    });
  });

  describe('useUpdateUserProfile', () => {
    it('should call updateProfile', async () => {
      (userApiClient.updateProfile as jest.Mock).mockResolvedValue({ userId: 'u1' });
      const { result } = renderHook(() => useUpdateUserProfile(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ userId: 'u1', data: { firstName: 'New' } } as any);
      });
      expect(userApiClient.updateProfile).toHaveBeenCalledWith('u1', { firstName: 'New' });
    });
  });

  describe('useDeactivateUser', () => {
    it('should call deactivate', async () => {
      (userApiClient.deactivate as jest.Mock).mockResolvedValue({ userId: 'u1' });
      const { result } = renderHook(() => useDeactivateUser(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('u1');
      });
      expect(userApiClient.deactivate).toHaveBeenCalledWith('u1');
    });
  });
});
