'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApiClient } from '../infrastructure/api-clients/auth-api.client';
import {
  authSignUpMockApiClient,
  type SignUpMockInput,
} from '../infrastructure/api-clients/auth-sign-up.mock.client';

const AUTH_KEY = 'auth';

type SignUpMutationEffects = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApiClient.signIn(email, password),
  });
}

export function useSignUp(effects?: SignUpMutationEffects) {
  return useMutation({
    mutationFn: (input: SignUpMockInput) => authSignUpMockApiClient.signUp(input),
    onSuccess: () => {
      effects?.onSuccess?.();
    },
    onError: (error) => {
      effects?.onError?.(error);
    },
  });
}

export function useCompleteNewPassword() {
  return useMutation({
    mutationFn: ({
      email,
      newPassword,
      session,
    }: {
      email: string;
      newPassword: string;
      session: string;
    }) => authApiClient.completeNewPassword(email, newPassword, session),
  });
}

export function useRefreshSession() {
  return useMutation({
    mutationFn: () => authApiClient.refreshSession(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      authApiClient.forgotPassword(email),
  });
}

export function useConfirmForgotPassword() {
  return useMutation({
    mutationFn: ({
      email,
      code,
      newPassword,
    }: {
      email: string;
      code: string;
      newPassword: string;
    }) => authApiClient.confirmForgotPassword(email, code, newPassword),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      oldPassword,
      newPassword,
    }: {
      oldPassword: string;
      newPassword: string;
    }) => authApiClient.changePassword(oldPassword, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AUTH_KEY, 'me'] });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApiClient.signOut(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: [AUTH_KEY, 'me'],
    queryFn: () => authApiClient.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
