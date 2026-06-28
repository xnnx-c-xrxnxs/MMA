jest.mock('../infrastructure/api-clients/order-api.client', () => ({
  orderApiClient: {
    getById: jest.fn(),
    listByStatus: jest.fn(),
    listByCustomer: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
    updateItemQuantity: jest.fn(),
    addPayment: jest.fn(),
    confirm: jest.fn(),
    process: jest.fn(),
    ship: jest.fn(),
    deliver: jest.fn(),
    cancel: jest.fn(),
    refund: jest.fn(),
    authorizePayment: jest.fn(),
    capturePayment: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useOrder,
  useOrdersByStatus,
  useOrdersByCustomer,
  useCreateOrder,
  useDeleteOrder,
  useAddOrderItem,
  useRemoveOrderItem,
  useUpdateOrderItemQuantity,
  useAddOrderPayment,
  useConfirmOrder,
  useProcessOrder,
  useShipOrder,
  useDeliverOrder,
  useCancelOrder,
  useRefundOrder,
} from './use-orders';
import { orderApiClient } from '../infrastructure/api-clients/order-api.client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('use-orders hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useOrder', () => {
    it('should fetch order by id', async () => {
      (orderApiClient.getById as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useOrder('o1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ orderId: 'o1' });
    });

    it('should not fetch when orderId is empty', () => {
      const { result } = renderHook(() => useOrder(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useOrdersByStatus', () => {
    it('should fetch orders by status', async () => {
      (orderApiClient.listByStatus as jest.Mock).mockResolvedValue({ data: [], total: 0 });
      const { result } = renderHook(
        () => useOrdersByStatus({ orderStatus: 'PENDING' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useOrdersByCustomer', () => {
    it('should fetch orders by customer', async () => {
      (orderApiClient.listByCustomer as jest.Mock).mockResolvedValue({ data: [] });
      const { result } = renderHook(
        () => useOrdersByCustomer({ customerId: 'u1' }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should not fetch when customerId is empty', () => {
      const { result } = renderHook(
        () => useOrdersByCustomer({ customerId: '' }),
        { wrapper: createWrapper() },
      );
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateOrder', () => {
    it('should call create', async () => {
      (orderApiClient.create as jest.Mock).mockResolvedValue({ orderId: 'o2' });
      const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ customerId: 'u1', items: [] } as any);
      });
      expect(orderApiClient.create).toHaveBeenCalled();
    });
  });

  describe('useDeleteOrder', () => {
    it('should call delete', async () => {
      (orderApiClient.delete as jest.Mock).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.delete).toHaveBeenCalledWith('o1');
    });
  });

  describe('useAddOrderItem', () => {
    it('should call addItem with orderId', async () => {
      (orderApiClient.addItem as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useAddOrderItem('o1'), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ productId: 'p1', quantity: 2, unitPrice: 10 } as any);
      });
      expect(orderApiClient.addItem).toHaveBeenCalledWith('o1', { productId: 'p1', quantity: 2, unitPrice: 10 });
    });
  });

  describe('useConfirmOrder', () => {
    it('should call confirm', async () => {
      (orderApiClient.confirm as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useConfirmOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.confirm).toHaveBeenCalledWith('o1', expect.anything());
    });
  });

  describe('useCancelOrder', () => {
    it('should call cancel', async () => {
      (orderApiClient.cancel as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useCancelOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.cancel).toHaveBeenCalledWith('o1', expect.anything());
    });
  });

  describe('useRemoveOrderItem', () => {
    it('should call removeItem with orderId and itemId', async () => {
      (orderApiClient.removeItem as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useRemoveOrderItem('o1'), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('item-1');
      });
      expect(orderApiClient.removeItem).toHaveBeenCalledWith('o1', 'item-1');
    });
  });

  describe('useUpdateOrderItemQuantity', () => {
    it('should call updateItemQuantity', async () => {
      (orderApiClient.updateItemQuantity as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useUpdateOrderItemQuantity('o1'), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ itemId: 'item-1', quantity: 3 } as any);
      });
      expect(orderApiClient.updateItemQuantity).toHaveBeenCalledWith('o1', { itemId: 'item-1', quantity: 3 });
    });
  });

  describe('useAddOrderPayment', () => {
    it('should call addPayment', async () => {
      (orderApiClient.addPayment as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useAddOrderPayment('o1'), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync({ amount: 100, method: 'CREDIT_CARD' } as any);
      });
      expect(orderApiClient.addPayment).toHaveBeenCalledWith('o1', { amount: 100, method: 'CREDIT_CARD' });
    });
  });

  describe('useProcessOrder', () => {
    it('should call process', async () => {
      (orderApiClient.process as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useProcessOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.process).toHaveBeenCalledWith('o1', expect.anything());
    });
  });

  describe('useShipOrder', () => {
    it('should call ship', async () => {
      (orderApiClient.ship as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useShipOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.ship).toHaveBeenCalledWith('o1', expect.anything());
    });
  });

  describe('useDeliverOrder', () => {
    it('should call deliver', async () => {
      (orderApiClient.deliver as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useDeliverOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.deliver).toHaveBeenCalledWith('o1', expect.anything());
    });
  });

  describe('useRefundOrder', () => {
    it('should call refund', async () => {
      (orderApiClient.refund as jest.Mock).mockResolvedValue({ orderId: 'o1' });
      const { result } = renderHook(() => useRefundOrder(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(orderApiClient.refund).toHaveBeenCalledWith('o1', expect.anything());
    });
  });
});
