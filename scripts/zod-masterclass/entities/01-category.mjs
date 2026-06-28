import base from '../../masterclass/entities/01-category.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createCategorySchema',
      code: `import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'updateCategorySchema',
      code: `// PATCH — every field optional. .partial() derives this from createCategorySchema
export const updateCategorySchema = createCategorySchema.partial();
// → { name?: string }
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;`,
    },
    {
      title: 'Response Schema',
      subtitle: 'categoryResponseSchema',
      code: `// API response — adds server-managed fields the client cannot send
export const categoryResponseSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;`,
    },
  ],
  zodTopics: ['z.object', 'z.string().min/max', '.partial()', 'z.infer'],
  discussionHtml: `
    <h4>Three schemas, one entity</h4>
    <p>Every domain entity exposes <strong>three</strong> Zod schemas to the outside world:</p>
    <ul>
      <li><code>createCategorySchema</code> — what the API accepts on <code>POST</code>. Strict; rejects unknown fields.</li>
      <li><code>updateCategorySchema</code> — what <code>PATCH</code> accepts. Derived via <code>.partial()</code> so we never restate the rules.</li>
      <li><code>categoryResponseSchema</code> — what the API returns. Adds server-managed fields (<code>categoryId</code>, <code>dateCreated</code>, <code>updatedAt</code>).</li>
    </ul>

    <h4><code>z.infer&lt;typeof schema&gt;</code> — schema is the type</h4>
    <p>You never hand-write <code>interface CreateCategoryInput</code>. The schema both <em>validates at runtime</em> and <em>generates the TypeScript type at compile time</em>. Add a field to the schema → the type updates automatically → every consumer gets a compile error until they handle it. Single source of truth.</p>

    <div class="callout success">
      <strong>Mapping to the entity</strong>
      Notice the create schema only has <code>name</code> — the same fields <code>Category.create()</code> requires. Server-managed fields (<code>categoryId</code>, timestamps) appear only in the response. The schemas mirror what each side of the wire actually owns.
    </div>
  `,
};
