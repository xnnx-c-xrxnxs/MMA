import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Shape of `request.user` populated by `JwtAuthGuard` after a successful
 * JWT verification. The guard reads the configured claims from the token
 * (`JwtConfig.userIdClaim`, `JwtConfig.userRoleClaim`, plus `email` /`sub`).
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  userRole?: string;
}

/**
 * Param decorator that extracts the authenticated actor from the request.
 *
 * Usage:
 *   @Post()
 *   create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateXDto) { ... }
 *
 *   // Field-level access:
 *   @Get('me')
 *   me(@CurrentUser('userId') userId: string) { ... }
 *
 * NEVER read userId/email/userRole from the request body, query string, or
 * path params — always source the actor from the JWT via this decorator.
 * (See Golden Rule #45 in `CLAUDE.md`.)
 *
 * Routes annotated with `@Public()` will not have `request.user` populated,
 * so do not use `@CurrentUser()` on public routes.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      // Should be unreachable: JwtAuthGuard runs first as APP_GUARD and either
      // populates request.user or throws UnauthorizedException. A missing user
      // here means a controller forgot @Public() AND the guard wiring is broken.
      throw new Error(
        'CurrentUser decorator used on a route without an authenticated user. ' +
          'Ensure JwtAuthGuard is wired as APP_GUARD and the route is not @Public().',
      );
    }
    return field ? user[field] : user;
  },
);
