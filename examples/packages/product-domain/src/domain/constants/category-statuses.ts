export const CATEGORY_STATUSES = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

export const CategoryStatusEnum = CATEGORY_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in CategoryStatus]: K }
);
