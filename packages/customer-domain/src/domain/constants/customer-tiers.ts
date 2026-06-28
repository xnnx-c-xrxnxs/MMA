/**
 * Customer tiers — single source of truth.
 * Drives SLA computation. Mirror this list in the contracts schema and the
 * persistence schema.
 */
export const CUSTOMER_TIERS = ['FREE', 'PRO', 'ENTERPRISE'] as const;

export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CustomerTierEnum = CUSTOMER_TIERS.reduce(
  (acc, tier) => ({ ...acc, [tier]: tier }),
  {} as Record<CustomerTier, CustomerTier>,
);
