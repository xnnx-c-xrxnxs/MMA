/**
 * User statuses - Domain constants
 * Single source of truth for user status values
 */
export const USER_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

// Derive enum object from array - no duplication!
export const UserStatusEnum = USER_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in UserStatus]: K }
);
