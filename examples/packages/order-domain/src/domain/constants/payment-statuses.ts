/**
 * Payment statuses - Domain constants
 * Single source of truth for payment status values
 */
export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Derive enum object from array - no duplication!
export const PaymentStatusEnum = PAYMENT_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in PaymentStatus]: K }
);
