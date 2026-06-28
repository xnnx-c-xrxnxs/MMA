/**
 * Shared E2E API Helpers
 *
 * Typed helper functions for creating, reading, and cleaning up test entities
 * via the actual REST APIs. Used by both API E2E tests and Playwright fixtures.
 *
 * Uses native fetch (no axios dependency).
 */

// ─── Auth token management ────────────────────────────────────────────────────

let accessToken: string | null = null;

/**
 * Sign in to the auth service and store the access token for subsequent API calls.
 * Uses the local auth provider's test credentials by default.
 */
export async function signIn(
  email = 'admin@test.com',
  password = 'Password123!',
): Promise<string> {
  const authUrl = process.env.API_AUTH_URL || 'http://localhost:3003/api';
  const res = await fetch(`${authUrl}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signIn failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { type: string; tokens?: { accessToken: string | null } };
  if (data.type !== 'SUCCESS') {
    throw new Error(`signIn returned unexpected type: ${data.type}`);
  }
  accessToken = data.tokens?.accessToken ?? null;
  return accessToken as string;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiCall(
  baseURL: string,
  path: string,
  options: FetchOptions = {},
): Promise<{ status: number; data: unknown }> {
  const { method = 'GET', body, headers = {} } = options;
  const authHeaders: Record<string, string> = {};
  if (accessToken) {
    authHeaders['Authorization'] = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

// ─── API base URLs ────────────────────────────────────────────────────────────

function getUserApiUrl(): string {
  return process.env.API_USER_URL || 'http://localhost:3000/api';
}

function getProductApiUrl(): string {
  return process.env.API_PRODUCT_URL || 'http://localhost:3001/api';
}

function getOrderApiUrl(): string {
  return process.env.API_ORDER_URL || 'http://localhost:3002/api';
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  userRole?: 'USER' | 'ADMIN';
}

export interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  userRole: string;
  userStatus: string;
  dateCreated: string;
  updatedAt: string;
}

export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const { status, data } = await apiCall(getUserApiUrl(), '/users', { method: 'POST', body: input });
  if (status !== 201) {
    throw new Error(`createUser failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as UserResponse;
}

export async function getUser(userId: string): Promise<UserResponse> {
  const { status, data } = await apiCall(getUserApiUrl(), `/users/${userId}`);
  if (status !== 200) {
    throw new Error(`getUser failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as UserResponse;
}

export async function deleteUser(userId: string): Promise<void> {
  await apiCall(getUserApiUrl(), `/users/${userId}`, { method: 'DELETE' });
}

export async function activateUser(userId: string): Promise<UserResponse> {
  const { status, data } = await apiCall(getUserApiUrl(), `/users/${userId}/activate`, { method: 'POST' });
  if (status !== 200) {
    throw new Error(`activateUser failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as UserResponse;
}

export async function verifyUserEmail(userId: string): Promise<UserResponse> {
  const { status, data } = await apiCall(getUserApiUrl(), `/users/${userId}/verify-email`, { method: 'POST' });
  if (status !== 200) {
    throw new Error(`verifyUserEmail failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as UserResponse;
}

// ─── Category helpers ─────────────────────────────────────────────────────────

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface CategoryResponse {
  categoryId: string;
  name: string;
  description?: string;
  status: string;
  dateCreated: string;
  updatedAt: string;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryResponse> {
  const { status, data } = await apiCall(getProductApiUrl(), '/categories', { method: 'POST', body: input });
  if (status !== 201) {
    throw new Error(`createCategory failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as CategoryResponse;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiCall(getProductApiUrl(), `/categories/${categoryId}`, { method: 'DELETE' });
}

// ─── Product helpers ──────────────────────────────────────────────────────────

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  inventory?: number;
}

export interface ProductResponse {
  productId: string;
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  inventory: number;
  status: string;
  dateCreated: string;
  updatedAt: string;
}

export async function createProduct(input: CreateProductInput): Promise<ProductResponse> {
  const { status, data } = await apiCall(getProductApiUrl(), '/products', { method: 'POST', body: input });
  if (status !== 201) {
    throw new Error(`createProduct failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as ProductResponse;
}

export async function getProduct(productId: string): Promise<ProductResponse> {
  const { status, data } = await apiCall(getProductApiUrl(), `/products/${productId}`);
  if (status !== 200) {
    throw new Error(`getProduct failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as ProductResponse;
}

export async function deleteProduct(productId: string): Promise<void> {
  await apiCall(getProductApiUrl(), `/products/${productId}`, { method: 'DELETE' });
}

export async function activateProduct(productId: string): Promise<ProductResponse> {
  const { status, data } = await apiCall(getProductApiUrl(), `/products/${productId}/activate`, { method: 'POST' });
  if (status !== 200) {
    throw new Error(`activateProduct failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as ProductResponse;
}

// ─── Order helpers ────────────────────────────────────────────────────────────

export interface OrderItemInput {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface CreateOrderInput {
  customerId: string;
  items: OrderItemInput[];
}

export interface OrderResponse {
  orderId: string;
  customerId: string;
  items: Array<{
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  payment?: {
    paymentId: string;
    paymentMethod: string;
    amount: number;
    status: string;
  };
  orderStatus: string;
  totalAmount: number;
  dateCreated: string;
  updatedAt: string;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderResponse> {
  const { status, data } = await apiCall(getOrderApiUrl(), '/orders', { method: 'POST', body: input });
  if (status !== 201) {
    throw new Error(`createOrder failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as OrderResponse;
}

export async function getOrder(orderId: string): Promise<OrderResponse> {
  const { status, data } = await apiCall(getOrderApiUrl(), `/orders/${orderId}`);
  if (status !== 200) {
    throw new Error(`getOrder failed (${status}): ${JSON.stringify(data)}`);
  }
  return data as OrderResponse;
}

export async function deleteOrder(orderId: string): Promise<void> {
  await apiCall(getOrderApiUrl(), `/orders/${orderId}`, { method: 'DELETE' });
}
