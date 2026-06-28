import { signIn, getAccessToken } from '@old-st/e2e-helpers';
import { receiveMessages, purgeQueue } from '../support/sqs-helper';

const orderBaseUrl = `http://${process.env.HOST ?? 'localhost'}:${process.env.ORDER_SERVICE_PORT ?? '3002'}/api`;
const userBaseUrl = `http://${process.env.HOST ?? 'localhost'}:${process.env.USER_SERVICE_PORT ?? '3000'}/api`;

function createFetchApi(base: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> => {
    const token = getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data };
  };
}

const api = createFetchApi(orderBaseUrl);
const userApi = createFetchApi(userBaseUrl);

/**
 * Order API E2E Tests
 *
 * Note: Order creation triggers an async product validation saga.
 * Orders start in DRAFT status and move to PENDING after validation succeeds.
 * These tests cover the synchronous API behavior — status may remain DRAFT
 * until the event handler processes the validation result.
 */
describe('Order API E2E — CRUD & Lifecycle', () => {
  const createdOrderIds: string[] = [];

  // SQS queue URL for verifying published events
  const productEventsQueueUrl =
    process.env.PRODUCT_EVENTS_SQS_QUEUE_URL ??
    'http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/product-events-e2e';

  // We need a valid customer (user) for orders.
  // Create via User API on a different port.
  let customerId: string;

  beforeAll(async () => {
    await signIn();

    const userRes = await userApi('POST', '/users', {
      email: `e2e-order-customer-${Date.now()}@test.example.com`,
      firstName: 'E2EOrder',
      lastName: 'Customer',
    });
    if (userRes.status === 201) {
      customerId = userRes.data.userId;
      // Activate the user (verify email + activate)
      await userApi('POST', `/users/${customerId}/verify-email`);
      await userApi('POST', `/users/${customerId}/activate`);
    } else {
      throw new Error(`Failed to create test customer: ${JSON.stringify(userRes.data)}`);
    }

    // Purge the product-events queue before tests to avoid stale messages
    await purgeQueue(productEventsQueueUrl);
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      try {
        await api('DELETE', `/orders/${id}`);
      } catch {
        // Ignore
      }
    }
    if (customerId) {
      try {
        await userApi('DELETE', `/users/${customerId}`);
      } catch {
        // Ignore
      }
    }
  });

  describe('POST /orders', () => {
    it('should create an order with items', async () => {
      const res = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-product-001',
            productName: 'E2E Test Product',
            quantity: 2,
            price: 29.99,
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.data.orderId).toBeDefined();
      expect(res.data.customerId).toBe(customerId);
      expect(res.data.orderStatus).toBe('DRAFT');
      expect(res.data.items.length).toBe(1);
      expect(res.data.totalAmount).toBeCloseTo(59.98, 2);

      createdOrderIds.push(res.data.orderId);
    });

    it('should publish ORDER_CREATED event to product-events queue', async () => {
      // Purge before this specific test to isolate the message
      await purgeQueue(productEventsQueueUrl);
      // Short delay after purge (60s cooldown may apply on real SQS, but LocalStack is immediate)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const res = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-product-sqs-check',
            productName: 'E2E SQS Verification Product',
            quantity: 1,
            price: 49.99,
          },
        ],
      });

      expect(res.status).toBe(201);
      createdOrderIds.push(res.data.orderId);

      // Verify the ORDER_CREATED event was published to the product-events queue
      const messages = await receiveMessages(productEventsQueueUrl, {
        maxRetries: 10,
        waitMs: 300,
      });

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const event = messages.find(
        (m: unknown) =>
          typeof m === 'object' &&
          m !== null &&
          'eventType' in m &&
          (m as Record<string, unknown>).eventType === 'ORDER_CREATED',
      ) as Record<string, unknown> | undefined;
      expect(event).toBeDefined();
      expect(event?.orderId).toBe(res.data.orderId);
      expect(event?.customerId).toBe(customerId);
      expect(event?.items).toBeDefined();
      expect(event?.occurredAt).toBeDefined();
    });

    it('should reject order with empty items', async () => {
      const res = await api('POST', '/orders', {
        customerId,
        items: [],
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /orders/:orderId', () => {
    it('should return an order by ID', async () => {
      const createRes = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-product-get',
            productName: 'E2E Get Product',
            quantity: 1,
            price: 19.99,
          },
        ],
      });
      createdOrderIds.push(createRes.data.orderId);

      const res = await api('GET', `/orders/${createRes.data.orderId}`);

      expect(res.status).toBe(200);
      expect(res.data.orderId).toBe(createRes.data.orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await api('GET', '/orders/non-existent-order-12345');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /orders/:orderId/items', () => {
    it('should add an item to a DRAFT order', async () => {
      const createRes = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-product-additem',
            productName: 'E2E AddItem Product',
            quantity: 1,
            price: 10.0,
          },
        ],
      });
      createdOrderIds.push(createRes.data.orderId);

      const res = await api('POST', `/orders/${createRes.data.orderId}/items`, {
        productId: 'e2e-product-additem-2',
        productName: 'E2E AddItem Product 2',
        quantity: 3,
        price: 15.0,
      });

      expect(res.status).toBe(200);
      expect(res.data.items.length).toBe(2);
    });
  });

  describe('DELETE /orders/:orderId/items/:itemId', () => {
    it('should remove an item from a DRAFT order', async () => {
      const createRes = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-prod-rm1',
            productName: 'Remove Item 1',
            quantity: 1,
            price: 10.0,
          },
          {
            productId: 'e2e-prod-rm2',
            productName: 'Remove Item 2',
            quantity: 1,
            price: 20.0,
          },
        ],
      });
      createdOrderIds.push(createRes.data.orderId);
      const itemIdToRemove = createRes.data.items[0].itemId;

      const res = await api('DELETE',
        `/orders/${createRes.data.orderId}/items/${itemIdToRemove}`,
      );

      expect(res.status).toBe(200);
      expect(res.data.items.length).toBe(1);
    });
  });

  describe('DELETE /orders/:orderId', () => {
    it('should delete a DRAFT order', async () => {
      const createRes = await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-product-del',
            productName: 'Delete Product',
            quantity: 1,
            price: 10.0,
          },
        ],
      });

      const res = await api('DELETE', `/orders/${createRes.data.orderId}`);
      expect([200, 204]).toContain(res.status);
    });
  });

  describe('GET /orders/by-customer', () => {
    it('should list orders for a customer', async () => {
      await api('POST', '/orders', {
        customerId,
        items: [
          {
            productId: 'e2e-prod-list',
            productName: 'List Product',
            quantity: 1,
            price: 10.0,
          },
        ],
      });

      const res = await api('GET', `/orders/by-customer?customerId=${customerId}&page=1&limit=10`);

      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.total).toBeGreaterThanOrEqual(1);
      expect(res.data.page).toBe(1);
    });
  });

  describe('GET /orders/by-status', () => {
    it('should list orders by status', async () => {
      const res = await api('GET', '/orders/by-status?orderStatus=DRAFT&page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      if (res.data.data.length > 0) {
        for (const order of res.data.data) {
          expect(order.orderStatus).toBe('DRAFT');
        }
      }
    });
  });
});
