/**
 * Order statuses - Domain constants
 * Single source of truth for order status values
 */
export const ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'VALIDATION_FAILED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Derive enum object from array - no duplication!
export const OrderStatusEnum = ORDER_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in OrderStatus]: K }
);
