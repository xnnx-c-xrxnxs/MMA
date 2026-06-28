/**
 * Per-event payload interfaces for User domain events.
 *
 * Each interface maps 1-to-1 with a variant in the Zod discriminated union
 * defined in packages/contracts/user/src/event-schemas.ts.
 *
 * Rules:
 *   - No NestJS decorators, no Zod imports — pure TypeScript interfaces.
 *   - Field names must exactly match the Zod schema variant field names.
 *   - Do NOT use `data: Record<string, any>` — define concrete fields for each event.
 */

export interface UserDeletedPayload {
  eventType: 'USER_DELETED';
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  userRole: string;
  userStatus: string;
  data: Record<string, unknown>;
  dateCreated?: string | null;
  deletedAt: string;
}

/** Union type over all user event payload variants. */
export type UserDomainEventPayload = UserDeletedPayload;
