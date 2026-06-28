jest.mock('./base-api.client', () => ({
  apiRequest: jest.fn(),
  apiRequestVoid: jest.fn(),
}));

import { orderApiClient } from './order-api.client';
import { apiRequest, apiRequestVoid } from './base-api.client';
import { configureApi } from '../config';

const mockApiRequest = apiRequest as jest.Mock;
const mockApiRequestVoid = apiRequestVoid as jest.Mock;

describe('orderApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureApi({ orderApiUrl: 'http://test:3002/api' });
  });

  it('create → POST /orders', async () => {
    const input = { customerId: 'usr-1', items: [] };
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await orderApiClient.create(input as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders',
      expect.objectContaining({ method: 'POST', body: input }),
    );
  });

  it('getById → GET /orders/:id', async () => {
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await orderApiClient.getById('ord-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/ord-1',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('listByStatus → GET /orders/by-status', async () => {
    mockApiRequest.mockResolvedValue({ data: [], total: 0 });
    await orderApiClient.listByStatus({ orderStatus: 'PENDING', page: 1, limit: 20 });
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/by-status',
      expect.objectContaining({
        params: expect.objectContaining({ orderStatus: 'PENDING', page: 1, limit: 20 }),
      }),
    );
  });

  it('listByCustomer → GET /orders/by-customer', async () => {
    mockApiRequest.mockResolvedValue({ data: [] });
    await orderApiClient.listByCustomer({ customerId: 'usr-1' });
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/by-customer',
      expect.objectContaining({ params: expect.objectContaining({ customerId: 'usr-1' }) }),
    );
  });

  it('delete → DELETE /orders/:id', async () => {
    mockApiRequestVoid.mockResolvedValue(undefined);
    await orderApiClient.delete('ord-1');
    expect(mockApiRequestVoid).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/ord-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('addItem → POST /orders/:id/items', async () => {
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await orderApiClient.addItem('ord-1', { productId: 'p-1', quantity: 2, unitPrice: 10 } as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/ord-1/items',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removeItem → DELETE /orders/:orderId/items/:itemId', async () => {
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await orderApiClient.removeItem('ord-1', 'item-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/ord-1/items/item-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it.each([
    ['confirm', '/orders/ord-1/confirm'],
    ['process', '/orders/ord-1/process'],
    ['ship', '/orders/ord-1/ship'],
    ['deliver', '/orders/ord-1/deliver'],
    ['cancel', '/orders/ord-1/cancel'],
    ['refund', '/orders/ord-1/refund'],
  ])('%s → POST %s', async (method, path) => {
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await (orderApiClient as any)[method]('ord-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      path,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('addPayment → POST /orders/:id/payment', async () => {
    mockApiRequest.mockResolvedValue({ orderId: '1' });
    await orderApiClient.addPayment('ord-1', { method: 'CREDIT_CARD', amount: 100 } as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3002/api',
      '/orders/ord-1/payment',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
