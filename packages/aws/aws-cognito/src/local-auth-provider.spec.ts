import { LocalAuthProvider } from './local-auth-provider';

describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider;

  beforeEach(() => {
    provider = new LocalAuthProvider();
  });

  // ── signIn ────────────────────────────────────────────────────────────────────

  describe('signIn()', () => {
    it('should return SUCCESS with tokens for valid credentials', async () => {
      const result = await provider.signIn('admin@test.com', 'Password123!');

      expect(result.type).toBe('SUCCESS');
      if (result.type === 'SUCCESS') {
        expect(result.tokens).toBeDefined();
        expect(result.tokens!.accessToken).toBeTruthy();
        expect(result.tokens!.idToken).toBeTruthy();
        expect(result.tokens!.refreshToken).toBeTruthy();
        expect(result.tokens!.expiresIn).toBe(3600);
      }
    });

    it('should return tokens with correct Cognito-compatible claims', async () => {
      const result = await provider.signIn('admin@test.com', 'Password123!');

      expect(result.type).toBe('SUCCESS');
      if (result.type === 'SUCCESS') {
        const parts = result.tokens!.accessToken.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        expect(payload['custom:userId']).toBeDefined();
        expect(payload['custom:userRole']).toBe('ADMIN');
        expect(payload.email).toBe('admin@test.com');
        expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      }
    });

    it('should throw for incorrect password', async () => {
      await expect(provider.signIn('admin@test.com', 'WrongPassword!')).rejects.toThrow(
        'Incorrect username or password.',
      );
    });

    it('should throw for unknown email', async () => {
      await expect(provider.signIn('unknown@test.com', 'Password123!')).rejects.toThrow(
        'Incorrect username or password.',
      );
    });
  });

  // ── refreshSession ────────────────────────────────────────────────────────────
  // NOTE: refreshSession must appear BEFORE completeNewPassword in test order.
  // completeNewPassword mutates the module-level LOCAL_USERS array (changes password),
  // so signIn('Password123!') would fail in subsequent test suites if run after it.

  describe('refreshSession()', () => {
    let savedRefreshToken: string;

    beforeAll(async () => {
      // Sign in with original credentials to obtain a refresh token
      const signInResult = await provider.signIn('admin@test.com', 'Password123!');
      expect(signInResult.type).toBe('SUCCESS');
      savedRefreshToken = (signInResult as any).tokens.refreshToken;
    });

    it('should return new tokens for a valid refresh token obtained from signIn', async () => {
      const tokens = await provider.refreshSession(savedRefreshToken);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.idToken).toBeTruthy();
    });

    it('should throw for an invalid refresh token', async () => {
      await expect(provider.refreshSession('invalid-token')).rejects.toThrow(
        'Invalid refresh token.',
      );
    });
  });

  // ── completeNewPassword ───────────────────────────────────────────────────────
  // NOTE: runs after refreshSession — mutates LOCAL_USERS[0].password to 'NewPass123!'

  describe('completeNewPassword()', () => {
    it('should throw for unknown user', async () => {
      await expect(
        provider.completeNewPassword('unknown@test.com', 'NewPass123!', 'session'),
      ).rejects.toThrow('User not found.');
    });

    it('should return tokens for known user', async () => {
      const tokens = await provider.completeNewPassword(
        'admin@test.com',
        'NewPass123!',
        'session',
      );

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.idToken).toBeTruthy();
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('should resolve without throwing for any email', async () => {
      await expect(provider.forgotPassword('admin@test.com')).resolves.toBeUndefined();
    });
  });

  // ── confirmForgotPassword ─────────────────────────────────────────────────────

  describe('confirmForgotPassword()', () => {
    it('should resolve without throwing for known user', async () => {
      await expect(
        provider.confirmForgotPassword('admin@test.com', '123456', 'NewPass1!'),
      ).resolves.toBeUndefined();
    });

    it('should throw for unknown user', async () => {
      await expect(
        provider.confirmForgotPassword('unknown@test.com', '123456', 'NewPass1!'),
      ).rejects.toThrow();
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('should resolve without throwing', async () => {
      await expect(
        provider.changePassword('access-token', 'OldPass123!', 'NewPass123!'),
      ).resolves.toBeUndefined();
    });
  });

  // ── signOut ───────────────────────────────────────────────────────────────────

  describe('signOut()', () => {
    it('should resolve without throwing', async () => {
      await expect(provider.signOut('access-token')).resolves.toBeUndefined();
    });
  });
});
