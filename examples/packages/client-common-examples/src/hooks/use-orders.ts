'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApiClient } from '../infrastructure/api-clients/order-api.client';
import type {
  CreateOrderInput,
  AddOrderItemInput,
  UpdateOrderItemQuantityInput,
  AddOrderPaymentInput,
} from '@old-st/contracts/order';

const ORDERS_KEY = 'orders';

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: [ORDERS_KEY, orderId],
    queryFn: () => orderApiClient.getById(orderId),
    enabled: !!orderId,
  });
}

export function useOrdersByStatus(params: {
  orderStatus: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'by-status', params],
    queryFn: () => orderApiClient.listByStatus(params),
  });
}

export function useOrdersByCustomer(params: {
  customerId: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'by-customer', params],
    queryFn: () => orderApiClient.listByCustomer(params),
    enabled: !!params.customerId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => orderApiClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderApiClient.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
    },
  });
}

export function useAddOrderItem(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddOrderItemInput) => orderApiClient.addItem(orderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, orderId] });
    },
  });
}

export function useRemoveOrderItem(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => orderApiClient.removeItem(orderId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, orderId] });
    },
  });
}

export function useUpdateOrderItemQuantity(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrderItemQuantityInput) =>
      orderApiClient.updateItemQuantity(orderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, orderId] });
    },
  });
}

export function useAddOrderPayment(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddOrderPaymentInput) =>
      orderApiClient.addPayment(orderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, orderId] });
    },
  });
}

function useOrderAction(action: (orderId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, 'by-status'] });
    },
  });
}

export function useConfirmOrder() {
  return useOrderAction(orderApiClient.confirm);
}

export function useProcessOrder() {
  return useOrderAction(orderApiClient.process);
}

export function useShipOrder() {
  return useOrderAction(orderApiClient.ship);
}

export function useDeliverOrder() {
  return useOrderAction(orderApiClient.deliver);
}

export function useCancelOrder() {
  return useOrderAction(orderApiClient.cancel);
}

export function useRefundOrder() {
  return useOrderAction(orderApiClient.refund);
}
