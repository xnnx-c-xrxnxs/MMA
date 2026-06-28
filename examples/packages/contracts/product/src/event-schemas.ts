import { z } from 'zod';
import {
  ProductEventTypeEnum,
} from '@old-st/product-domain';

// Re-export constants so consumers only need to import from @old-st/contracts/product
export { ProductEventTypeEnum };
export type { ProductEventType } from '@old-st/product-domain';

// ─── Per-variant schemas ──────────────────────────────────────────────────────

const productDeactivatedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_DEACTIVATED),
  correlationId: z.string().optional(),
  productId: z.string(),
  occurredAt: z.string(),
});

const productDiscontinuedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_DISCONTINUED),
  correlationId: z.string().optional(),
  productId: z.string(),
  occurredAt: z.string(),
});

const productDeletedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_DELETED),
  correlationId: z.string().optional(),
  productId: z.string(),
  occurredAt: z.string(),
});

const productPriceChangedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_PRICE_CHANGED),
  correlationId: z.string().optional(),
  productId: z.string(),
  oldPrice: z.number(),
  newPrice: z.number(),
  occurredAt: z.string(),
});

const productValidationSucceededSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_VALIDATION_SUCCEEDED),
  correlationId: z.string().optional(),
  orderId: z.string(),
  occurredAt: z.string(),
});

const productValidationFailedSchema = z.object({
  eventType: z.literal(ProductEventTypeEnum.PRODUCT_VALIDATION_FAILED),
  correlationId: z.string().optional(),
  orderId: z.string(),
  reason: z.string(),
  failedProducts: z.array(
    z.object({
      productId: z.string(),
      issue: z.string(),
    }),
  ),
  occurredAt: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────

export const productDomainEventSchema = z.discriminatedUnion('eventType', [
  productDeactivatedSchema,
  productDiscontinuedSchema,
  productDeletedSchema,
  productPriceChangedSchema,
  productValidationSucceededSchema,
  productValidationFailedSchema,
]);

export type ProductDomainEvent = z.infer<typeof productDomainEventSchema>;
