import { apiRequest } from './base-api.client';
import {
  signInResponseSchema,
  refreshSessionResponseSchema,
  forgotPasswordResponseSchema,
  confirmForgotPasswordResponseSchema,
  changePasswordResponseSchema,
  signOutResponseSchema,
  meResponseSchema,
  authTokensSchema,
  type SignInResponse,
  type AuthTokens,
  type MeResponse,
} from '@old-st/contracts/auth';
import { getApiConfig } from '../config';

const baseUrl = () => getApiConfig().authApiUrl;

export const authApiClient = {
  signIn(email: string, password: string): Promise<SignInResponse> {
    return apiRequest(baseUrl(), '/auth/sign-in', {
      method: 'POST',
      body: { email, password },
      schema: signInResponseSchema,
    });
  },

  completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ): Promise<AuthTokens> {
    return apiRequest(baseUrl(), '/auth/new-password', {
      method: 'POST',
      body: { email, newPassword, session },
      schema: authTokensSchema,
    });
  },

  refreshSession(): Promise<AuthTokens> {
    return apiRequest(baseUrl(), '/auth/refresh-session', {
      method: 'POST',
      schema: refreshSessionResponseSchema,
    });
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return apiRequest(baseUrl(), '/auth/forgot-password', {
      method: 'POST',
      body: { email },
      schema: forgotPasswordResponseSchema,
    });
  },

  confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return apiRequest(baseUrl(), '/auth/confirm-forgot-password', {
      method: 'POST',
      body: { email, code, newPassword },
      schema: confirmForgotPasswordResponseSchema,
    });
  },

  changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return apiRequest(baseUrl(), '/auth/change-password', {
      method: 'POST',
      body: { oldPassword, newPassword },
      schema: changePasswordResponseSchema,
    });
  },

  signOut(): Promise<{ message: string }> {
    return apiRequest(baseUrl(), '/auth/sign-out', {
      method: 'POST',
      schema: signOutResponseSchema,
    });
  },

  me(): Promise<MeResponse> {
    return apiRequest(baseUrl(), '/auth/me', {
      schema: meResponseSchema,
    });
  },
};
