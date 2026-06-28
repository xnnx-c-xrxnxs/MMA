/**
 * Per-event payload interfaces for Product domain events.
 *
 * Each interface maps 1-to-1 with a variant in the Zod discriminated union
 * defined in packages/contracts/product/src/event-schemas.ts.
 */

export interface ProductDeactivatedPayload {
  eventType: 'PRODUCT_DEACTIVATED';
  productId: string;
  occurredAt: string;
}

export interface ProductDiscontinuedPayload {
  eventType: 'PRODUCT_DISCONTINUED';
  productId: string;
  occurredAt: string;
}

export interface ProductDeletedPayload {
  eventType: 'PRODUCT_DELETED';
  productId: string;
  occurredAt: string;
}

export interface ProductPriceChangedPayload {
  eventType: 'PRODUCT_PRICE_CHANGED';
  productId: string;
  oldPrice: number;
  newPrice: number;
  occurredAt: string;
}

export type ProductDomainEventPayload =
  | ProductDeactivatedPayload
  | ProductDiscontinuedPayload
  | ProductDeletedPayload
  | ProductPriceChangedPayload;
