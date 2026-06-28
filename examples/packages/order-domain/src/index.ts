// Domain layer
export * from './domain';

// Application layer (use cases and interfaces)
export * from './application';

// Infrastructure is intentionally NOT exported here.
// Import from '@old-st/order-domain/infrastructure' in the composition root (NestJS module) only.
