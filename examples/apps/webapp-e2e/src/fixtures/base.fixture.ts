import { test as base, type APIRequestContext } from '@playwright/test';

/**
 * API helper facade using Playwright's built-in request context.
 * Seeds and cleans up test data without needing axios.
 */
export class ApiHelpers {
  constructor(
    private userApi: APIRequestContext,
    private productApi: APIRequestContext,
    private orderApi: APIRequestContext,
  ) {}

  // ── Users ──────────────────────────────────────────────────
  async createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    userRole?: string;
  }) {
    const res = await this.userApi.post('./users', { data: input });
    if (res.status() !== 201) {
      throw new Error(`createUser ${res.status()}: ${await res.text()}`);
    }
    return res.json();
  }

  async deleteUser(userId: string) {
    await this.userApi.delete(`./users/${userId}`);
  }

  async verifyUserEmail(userId: string) {
    const res = await this.userApi.post(`./users/${userId}/verify-email`);
    return res.json();
  }

  async activateUser(userId: string) {
    const res = await this.userApi.post(`./users/${userId}/activate`);
    return res.json();
  }

  async deactivateUser(userId: string) {
    const res = await this.userApi.post(`./users/${userId}/deactivate`);
    return res.json();
  }

  // ── Categories ─────────────────────────────────────────────
  async createCategory(input: { name: string; description?: string }) {
    const res = await this.productApi.post('./categories', { data: input });
    if (res.status() !== 201) {
      throw new Error(`createCategory ${res.status()}: ${await res.text()}`);
    }
    return res.json();
  }

  async deleteCategory(categoryId: string) {
    await this.productApi.delete(`./categories/${categoryId}`);
  }

  // ── Products ───────────────────────────────────────────────
  async createProduct(input: {
    name: string;
    description?: string;
    categoryId: string;
    price: number;
    inventory?: number;
  }) {
    const res = await this.productApi.post('./products', { data: input });
    if (res.status() !== 201) {
      throw new Error(`createProduct ${res.status()}: ${await res.text()}`);
    }
    return res.json();
  }

  async deleteProduct(productId: string) {
    await this.productApi.delete(`./products/${productId}`);
  }

  async activateProduct(productId: string) {
    const res = await this.productApi.post(`./products/${productId}/activate`);
    return res.json();
  }

  // ── Orders ─────────────────────────────────────────────────
  async createOrder(input: {
    customerId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
  }) {
    const res = await this.orderApi.post('./orders', { data: input });
    if (res.status() !== 201) {
      throw new Error(`createOrder ${res.status()}: ${await res.text()}`);
    }
    return res.json();
  }

  async deleteOrder(orderId: string) {
    await this.orderApi.delete(`./orders/${orderId}`);
  }
}

type Fixtures = {
  apiHelpers: ApiHelpers;
};

export const test = base.extend<Fixtures>({
  apiHelpers: async ({ playwright }, use) => {
    // Authenticate via the auth service to get an access token for direct API calls.
    // The storageState (browser cookies) does not carry over to request contexts.
    const authBaseUrl = (process.env.API_AUTH_URL || 'http://localhost:3003/api').replace(/\/*$/, '/');
    const authContext = await playwright.request.newContext({ baseURL: authBaseUrl });
    const signInRes = await authContext.post('./auth/sign-in', {
      data: { email: 'admin@test.com', password: 'Password123!' },
    });
    if (signInRes.status() !== 201) {
      throw new Error(`Auth sign-in failed ${signInRes.status()}: ${await signInRes.text()}`);
    }
    const { tokens } = await signInRes.json();
    await authContext.dispose();

    const authHeaders = { Authorization: `Bearer ${tokens.accessToken}` };

    const userApi = await playwright.request.newContext({
      baseURL: (process.env.API_USER_URL || 'http://localhost:3000/api').replace(/\/*$/, '/'),
      extraHTTPHeaders: authHeaders,
    });
    const productApi = await playwright.request.newContext({
      baseURL: (process.env.API_PRODUCT_URL || 'http://localhost:3001/api').replace(/\/*$/, '/'),
      extraHTTPHeaders: authHeaders,
    });
    const orderApi = await playwright.request.newContext({
      baseURL: (process.env.API_ORDER_URL || 'http://localhost:3002/api').replace(/\/*$/, '/'),
      extraHTTPHeaders: authHeaders,
    });

    const helpers = new ApiHelpers(userApi, productApi, orderApi);
    await use(helpers);

    await userApi.dispose();
    await productApi.dispose();
    await orderApi.dispose();
  },
});

export { expect } from '@playwright/test';
