import { z } from 'zod';
import { OrderEventTypeEnum } from '@old-st/order-domain';

// Re-export constants so consumers only need to import from @old-st/contracts/order
export { OrderEventTypeEnum };
export type { OrderEventType } from '@old-st/order-domain';

// ─── Per-variant schemas ──────────────────────────────────────────────────────

const orderCreatedEventSchema = z.object({
  eventType: z.literal(OrderEventTypeEnum.ORDER_CREATED),
  correlationId: z.string().optional(),
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  occurredAt: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────

export const orderDomainEventSchema = z.discriminatedUnion('eventType', [
  orderCreatedEventSchema,
]);

export type OrderDomainEvent = z.infer<typeof orderDomainEventSchema>;
