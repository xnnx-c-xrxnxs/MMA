import base from '../../masterclass/entities/06-order-items.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createOrderSchema (array of items)',
      code: `import { z } from 'zod';

// Each item is its own schema — reused in create, response, and even SQS events
export const orderItemInputSchema = z.object({
  productId: z.string(),
  quantity:  z.number().int().min(1).max(1000),
});

export const createOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(orderItemInputSchema)
    .min(1, { message: 'Order must have at least one item' })
    .max(50, { message: 'Order cannot exceed 50 line items' }),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'addItem / removeItem / updateQuantity',
      code: `// You don't PATCH the entire array — too many invariants to re-validate.
// Instead, dedicated routes for each item-level operation.

export const addOrderItemSchema = z.object({
  productId: z.string(),
  quantity:  z.number().int().min(1).max(1000),
});

export const updateItemQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(1000),
});

// removeItem: no body — DELETE /orders/:orderId/items/:itemId`,
    },
    {
      title: 'Response Schema',
      subtitle: 'orderResponseSchema (with computed totals)',
      code: `// Response items have an itemId + line total — server computed
export const orderItemResponseSchema = z.object({
  itemId:    z.string(),
  productId: z.string(),
  productName: z.string(),                 // snapshotted at order time
  quantity:  z.number().int(),
  unitPrice: z.number(),                   // snapshotted at order time
  lineTotal: z.number(),                   // quantity * unitPrice
});

export const orderResponseSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(orderItemResponseSchema),
  itemCount:    z.number().int(),          // items.length
  totalAmount:  z.number(),                // sum(lineTotal)
  dateCreated: z.string().datetime(),
  updatedAt:   z.string().datetime(),
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;`,
    },
  ],
  zodTopics: ['z.array().min(1).max(50)', 'Custom error messages', 'Input vs response item', 'Aggregate totals'],
  discussionHtml: `
    <h4>Arrays carry size invariants too</h4>
    <p>An order without items is meaningless; an order with 10,000 items will time out the database. The schema enforces both:</p>
    <pre style="background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.78rem;"><code>z.array(orderItemInputSchema)
  .min(1, { message: 'Order must have at least one item' })
  .max(50, { message: 'Order cannot exceed 50 line items' });</code></pre>
    <p>Custom messages travel into the <code>ZodError.issues[].message</code> field and bubble out as the 400 response body — actionable feedback for the client.</p>

    <h4>Two item schemas, not one</h4>
    <p><code>orderItemInputSchema</code> (just <code>productId</code> + <code>quantity</code>) and <code>orderItemResponseSchema</code> (adds <code>itemId</code>, <code>productName</code>, <code>unitPrice</code>, <code>lineTotal</code>) are <strong>different shapes</strong> — clients don't get to set the price; servers always populate snapshot fields. Mixing them into one optional-everything schema would let a client send <code>{ unitPrice: 0.01 }</code>.</p>

    <h4>Don't PATCH the whole items array</h4>
    <p>Replacing the array means re-validating the entire aggregate. Instead, expose item operations as routes: <code>POST /orders/:id/items</code>, <code>PATCH /orders/:id/items/:itemId/quantity</code>, <code>DELETE /orders/:id/items/:itemId</code>. Each route's schema is tiny; each maps to one entity method that runs only the relevant invariants.</p>
  `,
};
