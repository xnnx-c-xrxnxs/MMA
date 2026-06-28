/**
 * Payment methods - Domain constants
 * Single source of truth for payment method values
 */
export const PAYMENT_METHODS = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Derive enum object from array - no duplication!
export const PaymentMethodEnum = PAYMENT_METHODS.reduce(
  (acc, method) => ({ ...acc, [method]: method }),
  {} as { [K in PaymentMethod]: K }
);
