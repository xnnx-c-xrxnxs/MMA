import type { AuthenticatedUser } from '../decorators/current-user.decorator';

// Augment Express's Request to include the authenticated user populated by
// JwtAuthGuard. This makes `request.user` strongly typed everywhere — including
// inside controllers, interceptors, and middleware.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
