import base from '../../masterclass/entities/05-customer-address.mjs';

export default {
  ...base,
  schemas: [
    {
      title: 'Create Schema',
      subtitle: 'createCustomerSchema (nested Address)',
      code: `import { z } from 'zod';

// Value object — its own schema, reusable across customer + order
export const addressSchema = z.object({
  street:     z.string().min(1).max(200),
  city:       z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country:    z.string().length(2),     // ISO 3166-1 alpha-2: "US", "GB", ...
});
export type AddressInput = z.infer<typeof addressSchema>;

export const createCustomerSchema = z.object({
  email:           z.string().email(),
  firstName:       z.string().min(1).max(100),
  lastName:        z.string().min(1).max(100),
  shippingAddress: addressSchema,         // nested object, all fields required
  billingAddress:  addressSchema.optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;`,
    },
    {
      title: 'Update Schema',
      subtitle: 'updateCustomerSchema (nested .partial)',
      code: `// Update an address: replace the whole object, not individual fields.
// (Address is a value object — partial updates would create invalid intermediate states.)
export const updateCustomerSchema = z.object({
  firstName:       z.string().min(1).max(100).optional(),
  lastName:        z.string().min(1).max(100).optional(),
  shippingAddress: addressSchema.optional(),  // full replacement only
  billingAddress:  addressSchema.nullable().optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;`,
    },
    {
      title: 'Response Schema',
      subtitle: 'customerResponseSchema',
      code: `export const customerResponseSchema = z.object({
  customerId:      z.string(),
  email:           z.string().email(),
  firstName:       z.string(),
  lastName:        z.string(),
  shippingAddress: addressSchema,
  billingAddress:  addressSchema.nullable(),
  dateCreated:     z.string().datetime(),
  updatedAt:       z.string().datetime(),
});
export type CustomerResponse = z.infer<typeof customerResponseSchema>;`,
    },
  ],
  zodTopics: ['Nested objects', 'Reusable schemas', 'Value object → atomic replacement', '.length(2)'],
  discussionHtml: `
    <h4>Value objects get their own schema</h4>
    <p><code>addressSchema</code> is defined once and reused in <code>createCustomerSchema</code>, <code>updateCustomerSchema</code>, the order shipping address, and anywhere else an address surfaces. The same single source of truth principle that applies to enums applies to nested object shapes.</p>

    <h4>Partial updates and value objects don't mix</h4>
    <p>The entity's <code>Address</code> value object is <strong>immutable</strong> — you replace it whole, you don't mutate individual fields. The schema matches: <code>shippingAddress: addressSchema.optional()</code> accepts either a complete address or nothing — never a half-address. If you let clients send <code>{ shippingAddress: { city: 'Berlin' } }</code>, you'd build invalid Address instances.</p>

    <div class="callout">
      <strong>Field-level constraints carry semantic meaning</strong>
      <code>z.string().length(2)</code> is more than a length check — it documents that this is an ISO country code. Pair with <code>.regex(/^[A-Z]{2}$/)</code> for stronger enforcement, or build an <code>isoCountrySchema</code> alongside <code>addressSchema</code>.
    </div>
  `,
};
