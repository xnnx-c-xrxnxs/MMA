'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApiClient } from '../infrastructure/api-clients/user-api.client';
import type {
  CreateUserInput,
  UpdateUserInput,
  UpdateUserRoleInput,
  UserResponse,
} from '@old-st/contracts/user';
import { UserStatusEnum } from '@old-st/contracts/user';

const USERS_KEY = 'users';

export function useUser(userId: string) {
  return useQuery({
    queryKey: [USERS_KEY, userId],
    queryFn: () => userApiClient.getById(userId),
    enabled: !!userId,
  });
}

export function useUsersByStatus(params: {
  userStatus: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [USERS_KEY, 'by-status', params],
    queryFn: () => userApiClient.listByStatus(params),
  });
}

export function useUsersByRoleAndStatus(params: {
  userRole: string;
  userStatus: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [USERS_KEY, 'by-role-and-status', params],
    queryFn: () => userApiClient.listByRoleAndStatus(params),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => userApiClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserInput }) =>
      userApiClient.updateProfile(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, 'by-status'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userApiClient.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userApiClient.activate(userId),
    onMutate: async (userId: string) => {
      const detailKey = [USERS_KEY, userId];
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<UserResponse>(detailKey);
      if (previous) {
        queryClient.setQueryData<UserResponse>(detailKey, {
          ...previous,
          userStatus: UserStatusEnum.ACTIVE,
        });
      }
      return { previous, detailKey };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.previous && ctx.detailKey) {
        queryClient.setQueryData(ctx.detailKey, ctx.previous);
      }
    },
    onSettled: (_data, _err, userId) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, 'by-status'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userApiClient.deactivate(userId),
    onMutate: async (userId: string) => {
      const detailKey = [USERS_KEY, userId];
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<UserResponse>(detailKey);
      if (previous) {
        queryClient.setQueryData<UserResponse>(detailKey, {
          ...previous,
          userStatus: UserStatusEnum.INACTIVE,
        });
      }
      return { previous, detailKey };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.previous && ctx.detailKey) {
        queryClient.setQueryData(ctx.detailKey, ctx.previous);
      }
    },
    onSettled: (_data, _err, userId) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, 'by-status'] });
    },
  });
}

export function useVerifyUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userApiClient.verifyEmail(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, userId] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserRoleInput }) =>
      userApiClient.updateRole(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, 'by-role-and-status'] });
    },
  });
}
