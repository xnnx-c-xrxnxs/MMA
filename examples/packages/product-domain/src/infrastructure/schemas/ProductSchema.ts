import { Entity } from 'dynamodb-onetable';
import { PRODUCT_STATUSES, CATEGORY_STATUSES } from '../../domain/constants';

export const ProductSchema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' }, // Overloaded: products by status + categories by name
    GSI2: { hash: 'GSI2PK', sort: 'GSI2SK' }, // Query products by categoryId
    GSI4: { hash: 'GSI4PK', sort: 'GSI4SK' }, // Search products by name (prefix)
  },
  models: {
    Product: {
      PK: { type: String, value: 'PRODUCT', hidden: false },
      SK: { type: String, value: '${productId}', hidden: false },
      productId: { type: String, generate: 'ulid', required: true },
      name: { type: String, required: true },
      description: { type: String, required: false },
      categoryId: { type: String, required: true },
      price: { type: Number, required: true },
      inventory: { type: Number, required: true, default: 0 },
      status: {
        type: String,
        enum: PRODUCT_STATUSES,
        required: true,
        default: 'ACTIVE',
      },

      // GSI1: Query by status (e.g., all ACTIVE products)
      GSI1PK: { type: String, value: 'PRODUCT#${status}', hidden: false },
      GSI1SK: { type: String, value: '${name}', hidden: false },

      // GSI2: Query by categoryId (e.g., all products in category X)
      GSI2PK: { type: String, value: 'PRODUCT#CATEGORY#${categoryId}', hidden: false },
      GSI2SK: { type: String, value: '${name}', hidden: false },

      // GSI4: Name prefix search (all products sorted by name)
      GSI4PK: { type: String, value: 'PRODUCT', hidden: false },
      GSI4SK: { type: String, value: '${name}', hidden: false },
    },
    Category: {
      PK: { type: String, value: 'CATEGORY', hidden: false },
      SK: { type: String, value: '${categoryId}', hidden: false },
      categoryId: { type: String, generate: 'ulid', required: true },
      name: { type: String, required: true },
      description: { type: String, required: false },
      status: {
        type: String,
        enum: CATEGORY_STATUSES,
        required: true,
        default: 'ACTIVE',
      },

      // GSI1 (overloaded): Query all categories sorted by name
      // PK = 'CATEGORY' is distinct from Product's 'PRODUCT#${status}'.
      GSI1PK: { type: String, value: 'CATEGORY', hidden: false },
      GSI1SK: { type: String, value: '${name}', hidden: false },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};

export type ProductDataType = Entity<typeof ProductSchema.models.Product>;
export type CategoryDataType = Entity<typeof ProductSchema.models.Category>;
