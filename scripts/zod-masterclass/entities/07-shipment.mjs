import base from '../../masterclass/entities/07-shipment.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createShipmentSchema',
      code: `import { z } from 'zod';
import { addressSchema } from './customer.schemas';

export const createShipmentSchema = z.object({
  orderId:   z.string(),
  carrier:   z.string().min(1).max(50),
  toAddress: addressSchema,
  estimatedDelivery: z.string().datetime().optional(),
});
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;`,
    },
    {
      title: 'Action Schemas',
      subtitle: 'event-recording endpoints',
      code: `// Each event maps to ONE action endpoint. No "update shipment" route exists.

export const recordPickupSchema = z.object({
  carrierTrackingId: z.string().min(1),
  occurredAt:        z.string().datetime(),
});

export const recordInTransitSchema = z.object({
  location:   z.string().min(1).max(200),
  occurredAt: z.string().datetime(),
});

export const recordDeliveredSchema = z.object({
  signedBy:   z.string().min(1).optional(),
  occurredAt: z.string().datetime(),
});

export const recordExceptionSchema = z.object({
  reason:     z.string().min(1).max(500),
  occurredAt: z.string().datetime(),
});`,
    },
    {
      title: 'Response Schema',
      subtitle: 'shipmentResponseSchema (event log)',
      code: `import { SHIPMENT_STATUSES, SHIPMENT_EVENT_TYPES } from '@mma/shipping-domain';

const shipmentEventSchema = z.object({
  type:       z.enum(SHIPMENT_EVENT_TYPES),  // 'PICKED_UP' | 'IN_TRANSIT' | ...
  occurredAt: z.string().datetime(),
  // payload differs per event — use discriminated union if you need strict typing
  payload:    z.record(z.unknown()).optional(),
});

export const shipmentResponseSchema = z.object({
  shipmentId: z.string(),
  orderId:    z.string(),
  carrier:    z.string(),
  status:     z.enum(SHIPMENT_STATUSES),
  toAddress:  addressSchema,
  events:     z.array(shipmentEventSchema),  // append-only log, oldest first
  createdAt:  z.string().datetime(),
  updatedAt:  z.string().datetime(),
});
export type ShipmentResponse = z.infer<typeof shipmentResponseSchema>;`,
    },
  ],
  zodTopics: ['Append-only events', 'z.record() for open payloads', 'datetime() everywhere'],
  discussionHtml: `
    <h4>Append-only entities reshape the API</h4>
    <p>A Shipment never gets "updated" — it gets <em>events appended</em>. So the API surface is a set of action endpoints (one per event type), not a single PATCH. Each action endpoint has its own tiny schema describing only the data that event carries.</p>

    <h4><code>z.string().datetime()</code> for timestamps</h4>
    <p>Every event's <code>occurredAt</code> uses <code>z.string().datetime()</code>, which validates ISO 8601 strings (e.g. <code>"2026-05-08T14:30:00.000Z"</code>). The entity stores them as strings; the response returns them as strings; the client parses to <code>Date</code> only at display time. No timezone confusion across the wire.</p>

    <h4><code>z.record(z.unknown())</code> for heterogeneous payloads</h4>
    <p>If you need a strictly-typed events array, use a discriminated union (see Module 8). For internal monitoring or admin views where the payload shape varies and isn't safety-critical, <code>z.record(z.unknown())</code> accepts an object with arbitrary keys. Use sparingly — it's an escape hatch.</p>
  `,
};
