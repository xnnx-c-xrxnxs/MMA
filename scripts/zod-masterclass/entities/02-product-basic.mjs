import base from '../../masterclass/entities/02-product-basic.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createProductSchema',
      code: `import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),       // > 0
  stock: z.number().int().min(0),     // 0 or more, integer
  categoryId: z.string(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'updateProductSchema',
      code: `// PATCH — partial, but we further restrict what can change after creation
export const updateProductSchema = createProductSchema
  .partial()
  .omit({ categoryId: true });        // categoryId is immutable after creation
export type UpdateProductInput = z.infer<typeof updateProductSchema>;`,
    },
    {
      title: 'Response Schema',
      subtitle: 'productResponseSchema',
      code: `export const productResponseSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().nullable(),  // null when omitted on create
  price: z.number(),
  stock: z.number().int(),
  categoryId: z.string(),
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductResponse = z.infer<typeof productResponseSchema>;`,
    },
  ],
  zodTopics: ['z.number().positive()', '.int()', '.optional() vs .nullable()', '.omit()'],
  discussionHtml: `
    <h4>Numbers: <code>positive()</code>, <code>int()</code>, <code>min(0)</code></h4>
    <p>Zod number validators stack: <code>z.number().int().min(0)</code> means "an integer ≥ 0". <code>positive()</code> is strict (<code>&gt; 0</code>); use <code>min(0)</code> for "≥ 0". The entity also enforces these rules — Zod is the <strong>perimeter</strong>, the entity is the <strong>core</strong>.</p>

    <h4><code>.optional()</code> vs <code>.nullable()</code></h4>
    <ul>
      <li><code>z.string().optional()</code> → <code>string | undefined</code> — field can be missing from input.</li>
      <li><code>z.string().nullable()</code> → <code>string | null</code> — field is present but explicitly null.</li>
    </ul>
    <p>Convention here: <strong>inputs use <code>.optional()</code></strong> (clients omit fields they don't want to send); <strong>responses use <code>.nullable()</code></strong> (the API always returns the field, sometimes as null).</p>

    <h4>Deriving update from create</h4>
    <p><code>createProductSchema.partial().omit({ categoryId: true })</code> says: "all fields optional, except <code>categoryId</code> which can't be changed at all." Two operators express a real business rule. No hand-maintained second schema.</p>
  `,
};
