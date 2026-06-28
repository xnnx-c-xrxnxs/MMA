/**
 * User roles - Domain constants
 * Single source of truth for user role values
 */
export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

// Derive enum object from array - no duplication!
export const UserRoleEnum = USER_ROLES.reduce(
  (acc, role) => ({ ...acc, [role]: role }),
  {} as { [K in UserRole]: K }
);
