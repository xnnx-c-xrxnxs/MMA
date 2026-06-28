jest.mock('../infrastructure/api-clients/product-api.client', () => ({
  productApiClient: {
    getById: jest.fn(),
    listByStatus: jest.fn(),
    listByCategory: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    updateDetails: jest.fn(),
    updatePrice: jest.fn(),
    updateInventory: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
    discontinue: jest.fn(),
    delete: jest.fn(),
    checkAvailability: jest.fn(),
  },
  categoryApiClient: {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProduct,
  useProductsByStatus,
  useProductsByCategory,
  useProductSearch,
  useCreateProduct,
  useUpdateProductDetails,
  useUpdateProductPrice,
  useUpdateProductInventory,
  useActivateProduct,
  useDeactivateProduct,
  useDiscontinueProduct,
  useDeleteProduct,
  useCategories,
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './use-products';
import {
  productApiClient,
  categoryApiClient,
} from '../infrastructure/api-clients/product-api.client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('use-products hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useProduct', () => {
    it('should fetch product by id', async () => {
      (productApiClient.getById as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useProduct('p1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ productId: 'p1' });
    });
  });

  describe('useProductsByStatus', () => {
    it('should fetch products by status', async () => {
      (productApiClient.listByStatus as jest.Mock).mockResolvedValue({ items: [] });
      const { result } = renderHook(
        () => useProductsByStatus({ status: 'ACTIVE' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useProductsByCategory', () => {
    it('should fetch products by category', async () => {
      (productApiClient.listByCategory as jest.Mock).mockResolvedValue({ items: [] });
      const { result } = renderHook(
        () => useProductsByCategory({ categoryId: 'cat-1' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should not fetch when categoryId is empty', () => {
      const { result } = renderHook(
        () => useProductsByCategory({ categoryId: '' }),
        { wrapper: createWrapper() },
      );
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateProduct', () => {
    it('should call create', async () => {
      (productApiClient.create as jest.Mock).mockResolvedValue({ productId: 'p2' });
      const { result } = renderHook(() => useCreateProduct(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ name: 'W', categoryId: 'c1', price: 10, stockQuantity: 5 } as any);
      });
      expect(productApiClient.create).toHaveBeenCalled();
    });
  });

  describe('useDeleteProduct', () => {
    it('should call delete', async () => {
      (productApiClient.delete as jest.Mock).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteProduct(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('p1');
      });
      expect(productApiClient.delete).toHaveBeenCalledWith('p1');
    });
  });

  describe('useCategories', () => {
    it('should fetch categories', async () => {
      (categoryApiClient.list as jest.Mock).mockResolvedValue({ items: [] });
      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useCreateCategory', () => {
    it('should call create', async () => {
      (categoryApiClient.create as jest.Mock).mockResolvedValue({ categoryId: 'c1' });
      const { result } = renderHook(() => useCreateCategory(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ name: 'Electronics' } as any);
      });
      expect(categoryApiClient.create).toHaveBeenCalled();
    });
  });

  describe('useDeleteCategory', () => {
    it('should call delete', async () => {
      (categoryApiClient.delete as jest.Mock).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteCategory(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('c1');
      });
      expect(categoryApiClient.delete).toHaveBeenCalledWith('c1');
    });
  });

  describe('useProductSearch', () => {
    it('should search products', async () => {
      (productApiClient.search as jest.Mock).mockResolvedValue({ items: [] });
      const { result } = renderHook(
        () => useProductSearch({ searchTerm: 'widget' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(productApiClient.search).toHaveBeenCalled();
    });

    it('should not fetch when searchTerm is empty', () => {
      const { result } = renderHook(
        () => useProductSearch({ searchTerm: '' }),
        { wrapper: createWrapper() },
      );
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useUpdateProductDetails', () => {
    it('should call updateDetails', async () => {
      (productApiClient.updateDetails as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useUpdateProductDetails(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ productId: 'p1', data: { name: 'New' } } as any);
      });
      expect(productApiClient.updateDetails).toHaveBeenCalledWith('p1', { name: 'New' });
    });
  });

  describe('useUpdateProductPrice', () => {
    it('should call updatePrice', async () => {
      (productApiClient.updatePrice as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useUpdateProductPrice(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ productId: 'p1', data: { price: 99 } } as any);
      });
      expect(productApiClient.updatePrice).toHaveBeenCalledWith('p1', { price: 99 });
    });
  });

  describe('useUpdateProductInventory', () => {
    it('should call updateInventory', async () => {
      (productApiClient.updateInventory as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useUpdateProductInventory(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ productId: 'p1', data: { stockQuantity: 50 } } as any);
      });
      expect(productApiClient.updateInventory).toHaveBeenCalledWith('p1', { stockQuantity: 50 });
    });
  });

  describe('useActivateProduct', () => {
    it('should call activate', async () => {
      (productApiClient.activate as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useActivateProduct(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('p1');
      });
      expect(productApiClient.activate).toHaveBeenCalledWith('p1');
    });
  });

  describe('useDeactivateProduct', () => {
    it('should call deactivate', async () => {
      (productApiClient.deactivate as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useDeactivateProduct(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('p1');
      });
      expect(productApiClient.deactivate).toHaveBeenCalledWith('p1');
    });
  });

  describe('useDiscontinueProduct', () => {
    it('should call discontinue', async () => {
      (productApiClient.discontinue as jest.Mock).mockResolvedValue({ productId: 'p1' });
      const { result } = renderHook(() => useDiscontinueProduct(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('p1');
      });
      expect(productApiClient.discontinue).toHaveBeenCalledWith('p1');
    });
  });

  describe('useCategory', () => {
    it('should fetch category by id', async () => {
      (categoryApiClient.getById as jest.Mock).mockResolvedValue({ categoryId: 'c1', name: 'Electronics' });
      const { result } = renderHook(() => useCategory('c1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ categoryId: 'c1', name: 'Electronics' });
    });

    it('should not fetch when categoryId is empty', () => {
      const { result } = renderHook(() => useCategory(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useUpdateCategory', () => {
    it('should call update', async () => {
      (categoryApiClient.update as jest.Mock).mockResolvedValue({ categoryId: 'c1' });
      const { result } = renderHook(() => useUpdateCategory('c1'), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ name: 'Updated' } as any);
      });
      expect(categoryApiClient.update).toHaveBeenCalledWith('c1', { name: 'Updated' });
    });
  });
});
