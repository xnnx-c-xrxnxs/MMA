/**
 * Order domain events — constants
 * Single source of truth for every event type the order domain publishes.
 */
export const ORDER_EVENTS = ['ORDER_CREATED'] as const;

export type OrderEventType = (typeof ORDER_EVENTS)[number];

// Derive enum object from array — avoids duplication and bans the `enum` keyword.
export const OrderEventTypeEnum = ORDER_EVENTS.reduce(
  (acc, event) => ({ ...acc, [event]: event }),
  {} as { [K in OrderEventType]: K },
);
