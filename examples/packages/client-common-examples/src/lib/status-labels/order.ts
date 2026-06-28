import {
  OrderStatusEnum,
  PaymentStatusEnum,
  type OrderStatus,
  type PaymentStatus,
} from '@old-st/contracts/order';
import { formatStatus } from '../format-status';

const orderLabels: Record<OrderStatus, string> = {
  [OrderStatusEnum.DRAFT]: 'Draft',
  [OrderStatusEnum.PENDING]: 'Pending',
  [OrderStatusEnum.CONFIRMED]: 'Confirmed',
  [OrderStatusEnum.PROCESSING]: 'Processing',
  [OrderStatusEnum.SHIPPED]: 'Shipped',
  [OrderStatusEnum.DELIVERED]: 'Delivered',
  [OrderStatusEnum.CANCELLED]: 'Cancelled',
  [OrderStatusEnum.REFUNDED]: 'Refunded',
  [OrderStatusEnum.VALIDATION_FAILED]: 'Validation Failed',
};

const paymentLabels: Record<PaymentStatus, string> = {
  [PaymentStatusEnum.PENDING]: 'Pending',
  [PaymentStatusEnum.AUTHORIZED]: 'Authorized',
  [PaymentStatusEnum.CAPTURED]: 'Captured',
  [PaymentStatusEnum.FAILED]: 'Failed',
  [PaymentStatusEnum.CANCELLED]: 'Cancelled',
  [PaymentStatusEnum.REFUNDED]: 'Refunded',
};

export function formatOrderStatus(status: OrderStatus): string {
  return formatStatus(status, orderLabels);
}

export function formatPaymentStatus(status: PaymentStatus): string {
  return formatStatus(status, paymentLabels);
}
