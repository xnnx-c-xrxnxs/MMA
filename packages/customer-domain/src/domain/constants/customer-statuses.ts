/**
 * Customer statuses — single source of truth.
 * Mirror this list in the contracts schema and the persistence schema.
 */
export const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CustomerStatusEnum = CUSTOMER_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as Record<CustomerStatus, CustomerStatus>,
);
