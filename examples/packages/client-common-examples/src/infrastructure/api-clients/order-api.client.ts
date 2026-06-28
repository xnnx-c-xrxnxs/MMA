import { apiRequest, apiRequestVoid } from './base-api.client';
import {
  orderResponseSchema,
  type CreateOrderInput,
  type AddOrderItemInput,
  type UpdateOrderItemQuantityInput,
  type AddOrderPaymentInput,
  type OrderResponse,
} from '@old-st/contracts/order';
import { type OffsetPaginatedResponse, offsetPaginatedResponseSchema } from '@old-st/contracts/common';
import { getApiConfig } from '../config';

const paginatedOrdersSchema = offsetPaginatedResponseSchema(orderResponseSchema);

const baseUrl = () => getApiConfig().orderApiUrl;

export const orderApiClient = {
  create(input: CreateOrderInput): Promise<OrderResponse> {
    return apiRequest(baseUrl(), '/orders', {
      method: 'POST',
      body: input,
      schema: orderResponseSchema,
    });
  },

  getById(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}`, {
      schema: orderResponseSchema,
    });
  },

  listByCustomer(params: {
    customerId: string;
    page?: number;
    limit?: number;
  }): Promise<OffsetPaginatedResponse<OrderResponse>> {
    return apiRequest(baseUrl(), '/orders/by-customer', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedOrdersSchema,
    });
  },

  listByStatus(params: {
    orderStatus: string;
    page?: number;
    limit?: number;
  }): Promise<OffsetPaginatedResponse<OrderResponse>> {
    return apiRequest(baseUrl(), '/orders/by-status', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedOrdersSchema,
    });
  },

  delete(orderId: string): Promise<void> {
    return apiRequestVoid(baseUrl(), `/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
  },

  addItem(orderId: string, input: AddOrderItemInput): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/items`, {
      method: 'POST',
      body: input,
      schema: orderResponseSchema,
    });
  },

  removeItem(orderId: string, itemId: string): Promise<OrderResponse> {
    return apiRequest(
      baseUrl(),
      `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE', schema: orderResponseSchema },
    );
  },

  updateItemQuantity(orderId: string, input: UpdateOrderItemQuantityInput): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/items`, {
      method: 'PATCH',
      body: input,
      schema: orderResponseSchema,
    });
  },

  addPayment(orderId: string, input: AddOrderPaymentInput): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/payment`, {
      method: 'POST',
      body: input,
      schema: orderResponseSchema,
    });
  },

  authorizePayment(orderId: string, transactionId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/payment/authorize`, {
      method: 'POST',
      body: { transactionId },
      schema: orderResponseSchema,
    });
  },

  capturePayment(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/payment/capture`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  confirm(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/confirm`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  process(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/process`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  ship(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/ship`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  deliver(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/deliver`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  cancel(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },

  refund(orderId: string): Promise<OrderResponse> {
    return apiRequest(baseUrl(), `/orders/${encodeURIComponent(orderId)}/refund`, {
      method: 'POST',
      schema: orderResponseSchema,
    });
  },
};
