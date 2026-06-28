/**
 * Product domain events — constants
 * Single source of truth for every event type the product domain publishes.
 */
export const PRODUCT_EVENTS = [
  'PRODUCT_DEACTIVATED',
  'PRODUCT_DISCONTINUED',
  'PRODUCT_DELETED',
  'PRODUCT_PRICE_CHANGED',
  'PRODUCT_VALIDATION_SUCCEEDED',
  'PRODUCT_VALIDATION_FAILED',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENTS)[number];

export const ProductEventTypeEnum = PRODUCT_EVENTS.reduce(
  (acc, event) => ({ ...acc, [event]: event }),
  {} as { readonly [K in ProductEventType]: K },
);
