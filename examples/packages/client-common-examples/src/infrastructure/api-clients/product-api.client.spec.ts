jest.mock('./base-api.client', () => ({
  apiRequest: jest.fn(),
  apiRequestVoid: jest.fn(),
}));

import { productApiClient, categoryApiClient } from './product-api.client';
import { apiRequest, apiRequestVoid } from './base-api.client';
import { configureApi } from '../config';

const mockApiRequest = apiRequest as jest.Mock;
const mockApiRequestVoid = apiRequestVoid as jest.Mock;

describe('productApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureApi({ productApiUrl: 'http://test:3001/api' });
  });

  it('create → POST /products', async () => {
    const input = { name: 'Widget', categoryId: 'cat-1', price: 10, stockQuantity: 5 };
    mockApiRequest.mockResolvedValue({ productId: '1' });
    await productApiClient.create(input as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products',
      expect.objectContaining({ method: 'POST', body: input }),
    );
  });

  it('getById → GET /products/:id', async () => {
    mockApiRequest.mockResolvedValue({ productId: '1' });
    await productApiClient.getById('prod-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/prod-1',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('listByStatus → GET /products/by-status', async () => {
    mockApiRequest.mockResolvedValue({ items: [] });
    await productApiClient.listByStatus({ status: 'ACTIVE' });
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/by-status',
      expect.objectContaining({ params: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
  });

  it('checkAvailability → POST /products/availability', async () => {
    mockApiRequest.mockResolvedValue([]);
    await productApiClient.checkAvailability(['p-1', 'p-2']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/availability',
      expect.objectContaining({ method: 'POST', body: { productIds: ['p-1', 'p-2'] } }),
    );
  });

  it('updatePrice → PATCH /products/:id/price', async () => {
    mockApiRequest.mockResolvedValue({ productId: '1' });
    await productApiClient.updatePrice('prod-1', { price: 20 } as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/prod-1/price',
      expect.objectContaining({ method: 'PATCH', body: { price: 20 } }),
    );
  });

  it('delete → DELETE /products/:id', async () => {
    mockApiRequestVoid.mockResolvedValue(undefined);
    await productApiClient.delete('prod-1');
    expect(mockApiRequestVoid).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/prod-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('discontinue → POST /products/:id/discontinue', async () => {
    mockApiRequest.mockResolvedValue({ productId: '1' });
    await productApiClient.discontinue('prod-1');
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/products/prod-1/discontinue',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('categoryApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureApi({ productApiUrl: 'http://test:3001/api' });
  });

  it('create → POST /categories', async () => {
    mockApiRequest.mockResolvedValue({ categoryId: '1' });
    await categoryApiClient.create({ name: 'Electronics' } as any);
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/categories',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('list → GET /categories', async () => {
    mockApiRequest.mockResolvedValue({ items: [] });
    await categoryApiClient.list({ limit: 10 });
    expect(mockApiRequest).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/categories',
      expect.objectContaining({ params: expect.objectContaining({ limit: 10 }) }),
    );
  });

  it('delete → DELETE /categories/:id', async () => {
    mockApiRequestVoid.mockResolvedValue(undefined);
    await categoryApiClient.delete('cat-1');
    expect(mockApiRequestVoid).toHaveBeenCalledWith(
      'http://test:3001/api',
      '/categories/cat-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
