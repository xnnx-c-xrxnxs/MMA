import base from '../../masterclass/entities/08-order-aggregate.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createOrderSchema (with optional coupon + .refine)',
      code: `import { z } from 'zod';
import { PAYMENT_METHODS } from '@old-st/order-domain';

export const couponInputSchema = z.object({
  code:    z.string().regex(/^[A-Z0-9]{4,16}$/),  // uppercase alphanumeric
  percent: z.number().int().min(1).max(100),
});

export const orderItemInputSchema = z.object({
  productId: z.string(),
  quantity:  z.number().int().min(1).max(1000),
});

export const createOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(orderItemInputSchema).min(1).max(50),
  coupon: couponInputSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),         // 'CARD' | 'PAYPAL' | 'BANK'
})
.refine(
  (o) => new Set(o.items.map((i) => i.productId)).size === o.items.length,
  { message: 'Duplicate productIds — combine into one line item', path: ['items'] },
);
export type CreateOrderInput = z.infer<typeof createOrderSchema>;`,
    },
    {
      title: 'Action Schemas',
      subtitle: 'apply / pay / cancel',
      code: `// applyCoupon: replace existing coupon (or set first time)
export const applyCouponSchema = couponInputSchema;

export const recordPaymentSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  amount:        z.number().positive(),
  externalRef:   z.string().min(1),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

// confirm: no body — POST /orders/:id/confirm`,
    },
    {
      title: 'Response Schema',
      subtitle: 'orderResponseSchema (full aggregate)',
      code: `import { ORDER_STATUSES, PAYMENT_STATUSES } from '@old-st/order-domain';

const couponResponseSchema = z.object({
  code: z.string(), percent: z.number().int(),
});
const paymentResponseSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  status:        z.enum(PAYMENT_STATUSES),
  amount:        z.number(),
  paidAt:        z.string().datetime().nullable(),
});

export const orderResponseSchema = z.object({
  orderId:     z.string(),
  customerId:  z.string(),
  status:      z.enum(ORDER_STATUSES),
  items:       z.array(orderItemResponseSchema),
  coupon:      couponResponseSchema.nullable(),
  payment:     paymentResponseSchema.nullable(),
  subtotal:    z.number(),
  discount:    z.number(),
  totalAmount: z.number(),
  dateCreated: z.string().datetime(),
  updatedAt:   z.string().datetime(),
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;`,
    },
  ],
  zodTopics: ['.refine() cross-field', 'Nested schemas as objects', '.regex() for codes'],
  discussionHtml: `
    <h4><code>.refine()</code> for cross-field rules</h4>
    <p>Field-level validators (<code>.min()</code>, <code>.email()</code>) check one field at a time. <strong>Cross-field</strong> rules — "no duplicate <code>productId</code>s across the items array", "shipping date must be after order date" — need <code>.refine()</code>:</p>
    <pre style="background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.78rem;"><code>createOrderSchema.refine(
  (o) =&gt; new Set(o.items.map((i) =&gt; i.productId)).size === o.items.length,
  { message: 'Duplicate productIds', path: ['items'] },
);</code></pre>
    <p>The <code>path</code> matters — it tells the client <em>which field</em> the error attaches to, so a form library (react-hook-form, etc.) can show the message under the right input.</p>

    <h4>Aggregates: the response schema reads like a tree</h4>
    <p>Order has items, an optional coupon, an optional payment, and computed totals. The response schema mirrors that tree — each nested type has its own schema (<code>couponResponseSchema</code>, <code>paymentResponseSchema</code>) so they can be reused independently and tested in isolation.</p>

    <div class="callout warning">
      <strong>Don't try to encode <em>all</em> aggregate invariants in Zod.</strong>
      "Total = subtotal × (1 − discount)" lives in the <code>Order</code> entity. The schema validates <em>shape</em>; the entity validates <em>business correctness</em>. Trying to express the second in Zod ends in unreadable <code>.refine()</code> chains and duplicates the rule across two layers.
    </div>
  `,
};
