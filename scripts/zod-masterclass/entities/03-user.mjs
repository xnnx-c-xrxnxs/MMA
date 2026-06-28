import base from '../../masterclass/entities/03-user.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createUserSchema',
      code: `import { z } from 'zod';
import { USER_ROLES } from '@mma/user-domain';

// Re-export so the frontend doesn't import @mma/user-domain directly
export const userRoleSchema = z.enum(USER_ROLES);

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  userRole: userRoleSchema.optional().default('USER'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'updateUserSchema + query params',
      code: `// PATCH /users/:userId — only profile fields are mutable here.
// Status changes go through dedicated routes (see action endpoints below).
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Query params arrive as STRINGS over HTTP — z.coerce converts before validating
export const listUsersByStatusQuerySchema = z.object({
  userStatus: z.enum(USER_STATUSES),
  limit:     z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor:    z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});`,
    },
    {
      title: 'Response Schema',
      subtitle: 'userResponseSchema',
      code: `import { USER_STATUSES } from '@mma/user-domain';
export const userStatusSchema = z.enum(USER_STATUSES);

export const userResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean(),
  userRole: userRoleSchema,
  userStatus: userStatusSchema,        // type-narrowed: 'PENDING' | 'ACTIVE' | ...
  dateCreated: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;`,
    },
  ],
  zodTopics: ['z.enum(USER_STATUSES)', 'z.coerce.number()', '.default()', 'z.string().email()'],
  discussionHtml: `
    <h4>Enums from domain constants — never inline strings</h4>
    <p>The entity uses <code>UserStatusEnum.PENDING</code> for status comparisons (Golden Rule #8). The schema mirrors that:</p>
    <pre style="background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.78rem;"><code>// ✅ Correct — single source of truth
import { USER_STATUSES } from '@mma/user-domain';
const userStatusSchema = z.enum(USER_STATUSES);

// ❌ Wrong — duplicates the source of truth
const userStatusSchema = z.enum(['PENDING','ACTIVE','INACTIVE','DELETED']);</code></pre>
    <p>Add a new status to the domain constants → the schema picks it up automatically → every <code>switch (userStatus)</code> in the codebase becomes a TypeScript exhaustiveness error until you handle it.</p>

    <h4><code>z.coerce</code> — for query params and form data</h4>
    <p>Browsers send everything as strings: <code>?limit=20</code> arrives as <code>"20"</code>, not <code>20</code>. <code>z.coerce.number()</code> calls <code>Number(value)</code> first, then validates. Without it, every query-string number must be parsed manually.</p>

    <h4>Action endpoints have no body schema</h4>
    <p>State transitions like <code>POST /users/:userId/activate</code> take no input — the actor is the JWT, the subject is the URL param. No <code>body</code>, no schema. Use a <code>z.object({}).strict()</code> only if you want to actively reject anything in the body.</p>
  `,
};
