import { z } from 'zod';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
} from '@old-st/order-domain';

// ============================================
// Enums - Re-exported from domain
// ============================================

// Re-export domain constants for convenience
export { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS };
export { OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum };

// Zod schemas using domain constants
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

// ============================================
// Order Item Schemas
// ============================================

export const orderItemSchema = z.object({
  itemId: z.string().optional(),
  productId: z.string(),
  productName: z.string().min(1).max(200),
  quantity: z.number().min(1).max(1000),
  price: z.number().min(0),
  latestKnownPrice: z.number().nullable().optional(),
});

export const createOrderItemSchema = z.object({
  productId: z.string(),
  productName: z.string().min(1).max(200),
  quantity: z.number().min(1).max(1000),
  price: z.number().min(0),
});

// ============================================
// Payment Schemas
// ============================================

export const orderPaymentSchema = z.object({
  paymentId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema,
  amount: z.number().min(0),
  transactionId: z.string().nullable().optional(),
});

export const createOrderPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().min(0),
});

// ============================================
// Create Order Schema (API Input)
// ============================================

export const createOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(createOrderItemSchema).min(1),
});

// ============================================
// Update Order Schema (API Input)
// ============================================

export const updateOrderItemQuantitySchema = z.object({
  itemId: z.string(),
  quantity: z.number().min(1).max(1000),
});

export const addOrderItemSchema = createOrderItemSchema;

export const removeOrderItemSchema = z.object({
  itemId: z.string(),
});

export const addOrderPaymentSchema = createOrderPaymentSchema;

// ============================================
// Order Response Schema (API Output)
// ============================================

export const orderResponseSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(orderItemSchema),
  payment: orderPaymentSchema.nullable(),
  orderStatus: orderStatusSchema,
  totalAmount: z.number(),
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Query Schemas
// ============================================

export const getOrderByIdSchema = z.object({
  orderId: z.string(),
});

export const listOrdersByCustomerSchema = z.object({
  customerId: z.string(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

export const listOrdersByStatusSchema = z.object({
  orderStatus: orderStatusSchema,
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

export const listOrdersByProductSchema = z.object({
  productId: z.string(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(50),
});

export const listOrdersByProductAndDateRangeSchema = z.object({
  productId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  limit: z.number().min(1).max(100).optional().default(50),
});

// ============================================
// Order Actions
// ============================================

export const confirmOrderSchema = z.object({
  orderId: z.string(),
});

export const cancelOrderSchema = z.object({
  orderId: z.string(),
});

export const shipOrderSchema = z.object({
  orderId: z.string(),
});

export const deliverOrderSchema = z.object({
  orderId: z.string(),
});

export const refundOrderSchema = z.object({
  orderId: z.string(),
});

// ============================================
// Payment Actions
// ============================================

export const authorizePaymentSchema = z.object({
  orderId: z.string(),
  transactionId: z.string(),
});

export const capturePaymentSchema = z.object({
  orderId: z.string(),
});

// ============================================
// Type Exports (TypeScript Types)
// ============================================

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;
export type OrderPayment = z.infer<typeof orderPaymentSchema>;
export type CreateOrderPaymentInput = z.infer<typeof createOrderPaymentSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderItemQuantityInput = z.infer<typeof updateOrderItemQuantitySchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type RemoveOrderItemInput = z.infer<typeof removeOrderItemSchema>;
export type AddOrderPaymentInput = z.infer<typeof addOrderPaymentSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type GetOrderByIdInput = z.infer<typeof getOrderByIdSchema>;
export type ListOrdersByCustomerInput = z.infer<typeof listOrdersByCustomerSchema>;
export type ListOrdersByStatusInput = z.infer<typeof listOrdersByStatusSchema>;
export type ListOrdersByProductInput = z.infer<typeof listOrdersByProductSchema>;
export type ListOrdersByProductAndDateRangeInput = z.infer<typeof listOrdersByProductAndDateRangeSchema>;
