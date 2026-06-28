import { Entity } from 'dynamodb-onetable';
import { CUSTOMER_STATUSES, CUSTOMER_TIERS } from '../../domain/constants';

export const CustomerSchema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' }, // list by status
    GSI2: { hash: 'GSI2PK', sort: 'GSI2SK' }, // list by tier
    GSI3: { hash: 'GSI3PK' }, // resolve by userId (unique, hash-only)
    GSI4: { hash: 'GSI4PK' }, // email uniqueness + lookup (unique, hash-only)
  },
  models: {
    Customer: {
      PK: { type: String, value: 'CUSTOMER', hidden: false },
      SK: { type: String, value: '${customerId}', hidden: false },
      customerId: { type: String, generate: 'ulid' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      userId: { type: String },
      company: { type: String },
      tier: { type: String, enum: CUSTOMER_TIERS, required: true },
      customerStatus: { type: String, enum: CUSTOMER_STATUSES, required: true },
      dateCreated: { type: String },

      // ── GSI key fields ──
      GSI1PK: {
        type: String,
        value: 'CUSTOMER#${customerStatus}',
        hidden: false,
      },
      GSI1SK: { type: String, value: '${dateCreated}', hidden: false },

      GSI2PK: { type: String, value: 'CUSTOMER#TIER#${tier}', hidden: false },
      GSI2SK: { type: String, value: '${dateCreated}', hidden: false },

      GSI3PK: { type: String, value: 'CUSTOMER#USER#${userId}', hidden: false },

      GSI4PK: { type: String, value: 'CUSTOMER#EMAIL#${email}', hidden: false },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};

export type CustomerDataType = Entity<typeof CustomerSchema.models.Customer>;
