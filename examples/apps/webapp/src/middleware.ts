import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge auth middleware.
 *
 * The real auth check happens at the API. This middleware does best-effort
 * redirection so users don't see a flash of the protected UI before the
 * client-side gate kicks in. It reads a non-httpOnly `oldst.session` marker
 * cookie set by `AuthProvider` (in @old-st/client-common) — when the user
 * signs in or a silent refresh succeeds, the provider sets this cookie on
 * the webapp's own origin so the edge can read it. On sign-out the cookie
 * is cleared.
 *
 * The marker is intentionally non-secret — it does NOT prove the user is
 * authenticated. The API always re-validates. If the marker is stale, the
 * client-side `AuthProvider.silentRefresh()` will fail and redirect anyway.
 */
const SESSION_MARKER = 'oldst.session';

const PROTECTED_PREFIXES = [
  '/users',
  '/products',
  '/orders',
  '/payments',
];

const PUBLIC_PREFIXES = [
  '/auth',
  '/_next',
  '/api',
  '/favicon.ico',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public assets and auth routes.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only gate explicitly-protected prefixes — keeps marketing pages public.
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.get(SESSION_MARKER)?.value === '1';
  if (hasSession) return NextResponse.next();

  // Redirect to login, preserving the original destination.
  const loginUrl = new URL('/auth/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals + image optimization.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
