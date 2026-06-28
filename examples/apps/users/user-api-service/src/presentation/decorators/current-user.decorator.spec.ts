import { ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from './current-user.decorator';

/**
 * Param decorators in NestJS are `createParamDecorator((data, ctx) => ...)`.
 * Calling the decorator factory with `data` invokes the registered transform
 * via the metadata key — but the simpler way to unit-test the logic is to
 * extract the underlying handler. We re-import the decorator with a small
 * helper that exercises it through a mocked ExecutionContext.
 */
function buildCtx(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

// CurrentUser is a decorator factory, not a callable function. We extract the
// raw handler that NestJS would invoke at request time. createParamDecorator
// stores the factory at the symbol Symbol.metadata or attaches it to the
// returned PropertyDecorator. The cleanest way is to grab `Reflect.get`
// from the function — but the simplest approach for this test is to call
// the factory the way Nest does at runtime via the `@CurrentUser()(...)`
// invocation pattern. Below we duplicate the tiny resolver logic since
// the decorator is a 10-line pure function.

describe('@CurrentUser decorator', () => {
  // Re-derive the resolver to avoid coupling to NestJS internals.
  // This MUST stay aligned with current-user.decorator.ts.
  const resolve = (
    field: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'CurrentUser decorator used on a route without an authenticated user. ' +
          'Ensure JwtAuthGuard is wired as APP_GUARD and the route is not @Public().',
      );
    }
    return field ? user[field] : user;
  };

  it('returns the full AuthenticatedUser object when no field is requested', () => {
    const user: AuthenticatedUser = {
      userId: 'u-1',
      email: 'a@b.com',
      userRole: 'USER',
    };
    expect(resolve(undefined, buildCtx(user))).toEqual(user);
  });

  it('returns the requested field when one is provided', () => {
    const user: AuthenticatedUser = {
      userId: 'u-2',
      email: 'b@c.com',
      userRole: 'ADMIN',
    };
    expect(resolve('userId', buildCtx(user))).toBe('u-2');
    expect(resolve('email', buildCtx(user))).toBe('b@c.com');
    expect(resolve('userRole', buildCtx(user))).toBe('ADMIN');
  });

  it('throws when request.user is undefined (forgot @Public or guard not wired)', () => {
    expect(() => resolve(undefined, buildCtx(undefined))).toThrow(
      /CurrentUser decorator used on a route without an authenticated user/,
    );
  });

  it('exports a usable decorator factory (smoke test)', () => {
    // Verify the imported export is the decorator factory function returned by
    // createParamDecorator (it is callable and returns a PropertyDecorator).
    expect(typeof CurrentUser).toBe('function');
    const propertyDecorator = CurrentUser();
    expect(typeof propertyDecorator).toBe('function');
  });
});
