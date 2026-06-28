import base from '../../masterclass/entities/04-product-lifecycle.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createProductSchema (with status)',
      code: `import { z } from 'zod';
import { PRODUCT_STATUSES } from '@mma/product-domain';

export const productStatusSchema = z.enum(PRODUCT_STATUSES);

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  categoryId: z.string(),
  // status is NOT in the input — new products always start as DRAFT (entity invariant)
});
export type CreateProductInput = z.infer<typeof createProductSchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'updateProductSchema',
      code: `// Profile-only updates. Status changes go through dedicated action endpoints.
export const updateProductSchema = createProductSchema
  .omit({ categoryId: true })
  .partial();

// Action endpoints — no body, just the URL: POST /products/:id/publish
// POST /products/:id/discontinue
// PATCH /products/:id/price  ← takes only the new price
export const updateProductPriceSchema = z.object({
  price: z.number().positive(),
});`,
    },
    {
      title: 'Response Schema',
      subtitle: 'productResponseSchema',
      code: `export const productResponseSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stock: z.number().int(),
  categoryId: z.string(),
  status: productStatusSchema,           // 'DRAFT' | 'ACTIVE' | 'DISCONTINUED'
  publishedAt: z.string().datetime().nullable(),
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductResponse = z.infer<typeof productResponseSchema>;`,
    },
  ],
  zodTopics: ['Status NOT in input', 'Action endpoints', 'Schema reuse via .omit/.partial'],
  discussionHtml: `
    <h4>State machines: status leaves the input schema</h4>
    <p>Once an entity has lifecycle rules (DRAFT → ACTIVE → DISCONTINUED), the <code>status</code> field <strong>disappears</strong> from create and update schemas. Why?</p>
    <ul>
      <li>The entity decides the initial status: <code>Product.create()</code> always returns DRAFT.</li>
      <li>Each transition has its own rules: a discontinued product can't be republished. Encoding that in a single PATCH would require <code>.refine()</code> chains that re-implement the entity.</li>
      <li>Each transition gets a <strong>dedicated route</strong>: <code>POST /products/:id/publish</code>, <code>POST /products/:id/discontinue</code>. Each route's schema is the empty body or the minimal input it needs.</li>
    </ul>

    <h4>Composing schemas: <code>.omit().partial()</code></h4>
    <p>The update schema is one line: <code>createProductSchema.omit({ categoryId: true }).partial()</code>. Read it as: "everything you can create, except <code>categoryId</code>, all optional." Two operators encode two business rules. The day someone adds a new field to <code>createProductSchema</code>, the update schema auto-includes it — opt-out, not opt-in.</p>
  `,
};
