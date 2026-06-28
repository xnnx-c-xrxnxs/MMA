export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ProductStatusEnum = PRODUCT_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in ProductStatus]: K }
);
