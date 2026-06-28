import { z } from 'zod';
import { UserEventTypeEnum } from '@old-st/user-domain';

// Re-export constants so consumers only need to import from @old-st/contracts
export { UserEventTypeEnum };
export type { UserEventType } from '@old-st/user-domain';

// ─── Per-variant schemas ──────────────────────────────────────────────────────
// Each object schema must include `eventType: z.literal(...)` as the discriminant
// field. All other fields are specific to that event.

const userDeletedEventSchema = z.object({
  eventType: z.literal(UserEventTypeEnum.USER_DELETED),
  correlationId: z.string().optional(),
  userId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  userRole: z.string(),
  userStatus: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
  dateCreated: z.string().nullable().optional(),
  deletedAt: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────
// z.discriminatedUnion uses the 'eventType' discriminant to skip irrelevant
// variants — faster than z.union for large event sets.
export const userDomainEventSchema = z.discriminatedUnion('eventType', [
  userDeletedEventSchema,
]);

export type UserDomainEvent = z.infer<typeof userDomainEventSchema>;
