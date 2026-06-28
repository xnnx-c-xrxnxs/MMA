import type { IAuthProvider, AuthTokens, SignInResult } from './auth-provider.interface';

/**
 * LocalAuthProvider — In-memory mock auth provider for local development.
 *
 * Accepts a hardcoded test user and issues mock JWT-like tokens.
 * No external dependencies. Stateless except for the in-memory token store.
 *
 * Test credentials:
 *   email: admin@test.com
 *   password: Password123!
 */

interface LocalUser {
  email: string;
  password: string;
  userId: string;
  userRole: string;
  requiresNewPassword: boolean;
}

const LOCAL_USERS: LocalUser[] = [
  {
    email: 'admin@test.com',
    password: 'Password123!',
    userId: '01JDEFAULT00ADMIN000000001',
    userRole: 'ADMIN',
    requiresNewPassword: false,
  },
];

// Simple base64-encoded mock token (NOT cryptographically signed — local dev only)
function createMockToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `${header}.${body}.local-dev-signature`;
}

function createMockTokens(user: LocalUser): AuthTokens {
  const now = Math.floor(Date.now() / 1000);
  return {
    accessToken: createMockToken({
      sub: user.userId,
      email: user.email,
      'custom:userId': user.userId,
      'custom:userRole': user.userRole,
      token_use: 'access',
    }),
    idToken: createMockToken({
      sub: user.userId,
      email: user.email,
      'custom:userId': user.userId,
      'custom:userRole': user.userRole,
      token_use: 'id',
    }),
    refreshToken: `local-refresh-${user.userId}-${now}`,
    expiresIn: 3600,
  };
}

// Stores refresh tokens in memory (lost on restart — fine for local dev)
const refreshTokenStore = new Map<string, LocalUser>();

export class LocalAuthProvider implements IAuthProvider {
  async signIn(email: string, password: string): Promise<SignInResult> {
    const user = LOCAL_USERS.find(
      (u) => u.email === email && u.password === password,
    );

    if (!user) {
      throw new Error('Incorrect username or password.');
    }

    if (user.requiresNewPassword) {
      return {
        type: 'NEW_PASSWORD_REQUIRED',
        session: `local-session-${user.userId}`,
      };
    }

    const tokens = createMockTokens(user);
    if (tokens.refreshToken) {
      refreshTokenStore.set(tokens.refreshToken, user);
    }

    return { type: 'SUCCESS', tokens };
  }

  async completeNewPassword(
    email: string,
    newPassword: string,
    _session: string,
  ): Promise<AuthTokens> {
    const user = LOCAL_USERS.find((u) => u.email === email);
    if (!user) {
      throw new Error('User not found.');
    }

    // Update local user password
    user.password = newPassword;
    user.requiresNewPassword = false;

    const tokens = createMockTokens(user);
    if (tokens.refreshToken) {
      refreshTokenStore.set(tokens.refreshToken, user);
    }
    return tokens;
  }

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    // First, try the in-memory store (fast path).
    let user = refreshTokenStore.get(refreshToken);

    // Fallback: parse the token format to reconstruct the user without the
    // store. This makes local dev stateless across NestJS service restarts —
    // hot-reload clears the Map, but the httpOnly cookie still holds a valid
    // token that encodes the userId. Format: local-refresh-{userId}-{timestamp}
    if (!user) {
      const match = /^local-refresh-(.+)-\d+$/.exec(refreshToken);
      if (match) {
        const userId = match[1];
        user = LOCAL_USERS.find((u) => u.userId === userId);
      }
    }

    if (!user) {
      throw new Error('Invalid refresh token.');
    }

    const tokens = createMockTokens(user);
    // Keep the original token valid (no rotation) so E2E tests can reuse
    // the same storageState refresh token across multiple test contexts.
    if (tokens.refreshToken) {
      refreshTokenStore.set(tokens.refreshToken, user);
    }
    return tokens;
  }

  async forgotPassword(_email: string): Promise<void> {
    // No-op in local dev — just log
    console.log('[local-auth] Forgot password requested (no-op in local mode)');
  }

  async confirmForgotPassword(
    email: string,
    _code: string,
    _newPassword: string,
  ): Promise<void> {
    const user = LOCAL_USERS.find((u) => u.email === email);
    if (!user) {
      throw new Error('User not found.');
    }
    // No-op — do not mutate password so test suite state stays consistent.
    // The local provider is a dev/test double, not a real password store.
    console.log(`[local-auth] confirmForgotPassword for ${email} (no-op in local mode)`);
  }

  async changePassword(
    _accessToken: string,
    _oldPassword: string,
    _newPassword: string,
  ): Promise<void> {
    // No-op — do not mutate password so test suite state stays consistent.
    // The local provider is a dev/test double, not a real password store.
    console.log('[local-auth] changePassword (no-op in local mode)');
  }

  async signOut(_accessToken: string): Promise<void> {
    // Clear all refresh tokens for simplicity in local dev
    refreshTokenStore.clear();
    console.log('[local-auth] Signed out (all local refresh tokens cleared)');
  }
}
