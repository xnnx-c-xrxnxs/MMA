import base from '../../masterclass/entities/09-subscription.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createSubscriptionSchema',
      code: `import { z } from 'zod';
import { SUBSCRIPTION_PLANS } from '@old-st/billing-domain';

export const planSchema = z.enum(SUBSCRIPTION_PLANS);  // 'FREE' | 'PRO' | 'ENTERPRISE'

export const createSubscriptionSchema = z.object({
  customerId:   z.string(),
  plan:         planSchema,
  trialDays:    z.number().int().min(0).max(30).optional().default(14),
  startedAt:    z.string().datetime().optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;`,
    },
    {
      title: 'Action Schemas',
      subtitle: 'upgrade / downgrade / cancel',
      code: `// Upgrades take effect immediately; downgrades are deferred to period end
export const changePlanSchema = z.object({
  newPlan: planSchema,
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
  reason:    z.string().min(1).max(500).optional(),
});

// resumeTrial / endTrialNow: no body`,
    },
    {
      title: 'Response Schema (Discriminated Union)',
      subtitle: 'subscriptionResponseSchema',
      code: `// Different states carry different fields — a discriminated union models this exactly
const trialingSubscriptionSchema = z.object({
  status:        z.literal('TRIALING'),
  plan:          planSchema,
  trialEndsAt:   z.string().datetime(),
  startedAt:     z.string().datetime(),
});

const activeSubscriptionSchema = z.object({
  status:           z.literal('ACTIVE'),
  plan:             planSchema,
  currentPeriodEnd: z.string().datetime(),
  pendingDowngrade: planSchema.nullable(),    // set if downgrade scheduled
  startedAt:        z.string().datetime(),
});

const cancelledSubscriptionSchema = z.object({
  status:      z.literal('CANCELLED'),
  plan:        planSchema,
  cancelledAt: z.string().datetime(),
  reason:      z.string().nullable(),
});

const subscriptionStateSchema = z.discriminatedUnion('status', [
  trialingSubscriptionSchema,
  activeSubscriptionSchema,
  cancelledSubscriptionSchema,
]);

export const subscriptionResponseSchema = z.object({
  subscriptionId: z.string(),
  customerId:     z.string(),
  state:          subscriptionStateSchema,    // ← narrows by 'status'
  dateCreated:    z.string().datetime(),
  updatedAt:      z.string().datetime(),
});
export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;`,
    },
  ],
  zodTopics: ['z.discriminatedUnion()', 'z.literal()', 'State-shape correlation', 'Type narrowing'],
  discussionHtml: `
    <h4>Discriminated unions: status drives shape</h4>
    <p>A trialing subscription has <code>trialEndsAt</code>; a cancelled one has <code>cancelledAt</code> and <code>reason</code>. Modelling them as one fat optional-everything object makes the consumer write <code>state.trialEndsAt!</code> everywhere — defeating both Zod and TypeScript.</p>
    <p><code>z.discriminatedUnion('status', [...])</code> tells Zod to look at the <code>status</code> literal and pick the matching variant. TypeScript narrows automatically:</p>
    <pre style="background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.78rem;"><code>const sub = subscriptionResponseSchema.parse(json);
if (sub.state.status === 'TRIALING') {
  sub.state.trialEndsAt;     // ✅ TypeScript knows this exists
  sub.state.cancelledAt;     // ❌ Compile error — wrong variant
}</code></pre>

    <h4><code>parse</code> vs <code>safeParse</code> — when to crash</h4>
    <ul>
      <li><strong><code>schema.parse(data)</code></strong> — throws <code>ZodError</code>. Use in <strong>application services</strong> mapping entities to DTOs (a malformed entity = bug = crash, then <code>DomainExceptionFilter</code> turns it into 500).</li>
      <li><strong><code>schema.safeParse(data)</code></strong> — returns <code>{ success, data | error }</code>. Use in <strong>NestJS pipes</strong> (turn errors into 400) and <strong>SQS handlers</strong> (skip malformed messages, let the rest of the batch succeed).</li>
    </ul>

    <h4>Where it all comes together — <code>ZodValidationPipe</code></h4>
    <pre style="background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.78rem;"><code>// presentation/pipes/zod-validation.pipe.ts
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return result.data;
  }
}

// controller
@Post()
createSubscription(
  @Body(new ZodValidationPipe(createSubscriptionSchema))
  body: CreateSubscriptionInput,
) { return this.appService.create(body); }</code></pre>
    <p>One pipe, every endpoint. The schema is the contract; the pipe enforces it; the type flows into the controller method signature. End of validation story.</p>
  `,
};
