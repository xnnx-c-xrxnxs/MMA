import { apiRequest, apiRequestVoid } from './base-api.client';
import {
  userResponseSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UpdateUserRoleInput,
  type UserResponse,
} from '@old-st/contracts/user';
import { type PaginatedResponse, paginatedResponseSchema } from '@old-st/contracts/common';
import { getApiConfig } from '../config';

const paginatedUsersSchema = paginatedResponseSchema(userResponseSchema);

const baseUrl = () => getApiConfig().userApiUrl;

export const userApiClient = {
  create(input: CreateUserInput): Promise<UserResponse> {
    return apiRequest(baseUrl(), '/users', {
      method: 'POST',
      body: input,
      schema: userResponseSchema,
    });
  },

  getById(userId: string): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}`, {
      schema: userResponseSchema,
    });
  },

  getByEmail(email: string): Promise<UserResponse> {
    return apiRequest(baseUrl(), '/users', {
      params: { email },
      schema: userResponseSchema,
    });
  },

  listByStatus(params: {
    userStatus: string;
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<UserResponse>> {
    return apiRequest(baseUrl(), '/users/by-status', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedUsersSchema,
    });
  },

  listByRoleAndStatus(params: {
    userRole: string;
    userStatus: string;
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<UserResponse>> {
    return apiRequest(baseUrl(), '/users/by-role-and-status', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedUsersSchema,
    });
  },

  updateProfile(userId: string, input: UpdateUserInput): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: input,
      schema: userResponseSchema,
    });
  },

  delete(userId: string): Promise<void> {
    return apiRequestVoid(baseUrl(), `/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },

  activate(userId: string): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}/activate`, {
      method: 'POST',
      schema: userResponseSchema,
    });
  },

  deactivate(userId: string): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}/deactivate`, {
      method: 'POST',
      schema: userResponseSchema,
    });
  },

  verifyEmail(userId: string): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}/verify-email`, {
      method: 'POST',
      schema: userResponseSchema,
    });
  },

  updateRole(userId: string, input: UpdateUserRoleInput): Promise<UserResponse> {
    return apiRequest(baseUrl(), `/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: input,
      schema: userResponseSchema,
    });
  },
};
