/**
 * User domain events — constants
 * Single source of truth for every event type the user domain emits.
 */

export const USER_EVENTS = [
  'USER_DELETED',
] as const;

export type UserEventType = (typeof USER_EVENTS)[number];

// Derive enum object from array — avoids duplication and bans the `enum` keyword.
export const UserEventTypeEnum = USER_EVENTS.reduce(
  (acc, event) => ({ ...acc, [event]: event }),
  {} as { [K in UserEventType]: K },
);
