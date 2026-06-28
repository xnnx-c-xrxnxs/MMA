import { AuthApplicationService } from './auth-application.service';
import type { IAuthProvider } from '@mma/aws-cognito';

function createMockProvider(overrides: Partial<IAuthProvider> = {}): IAuthProvider {
  return {
    signIn: jest.fn(),
    completeNewPassword: jest.fn(),
    refreshSession: jest.fn(),
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    changePassword: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  } as unknown as IAuthProvider;
}

const MOCK_TOKENS = {
  accessToken: 'access-token',
  idToken: 'id-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let mockProvider: IAuthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider = createMockProvider();
    service = new AuthApplicationService(mockProvider);
  });

  // ── signIn ───────────────────────────────────────────────────────────────────

  describe('signIn()', () => {
    it('should return SUCCESS dto and refreshToken on valid credentials', async () => {
      (mockProvider.signIn as jest.Mock).mockResolvedValue({
        type: 'SUCCESS',
        tokens: MOCK_TOKENS,
      });

      const result = await service.signIn('admin@test.com', 'Password123!');

      expect(result.dto.type).toBe('SUCCESS');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockProvider.signIn).toHaveBeenCalledWith('admin@test.com', 'Password123!');
    });

    it('should return NEW_PASSWORD_REQUIRED dto without refreshToken', async () => {
      (mockProvider.signIn as jest.Mock).mockResolvedValue({
        type: 'NEW_PASSWORD_REQUIRED',
        session: 'session-abc',
      });

      const result = await service.signIn('admin@test.com', 'Password123!');

      expect(result.dto.type).toBe('NEW_PASSWORD_REQUIRED');
      expect(result.refreshToken).toBeUndefined();
    });

    it('should propagate provider errors', async () => {
      (mockProvider.signIn as jest.Mock).mockRejectedValue(
        new Error('Incorrect username or password.'),
      );

      await expect(service.signIn('bad@test.com', 'wrong')).rejects.toThrow(
        'Incorrect username or password.',
      );
    });
  });

  // ── completeNewPassword ───────────────────────────────────────────────────────

  describe('completeNewPassword()', () => {
    it('should return tokens dto and refreshToken', async () => {
      (mockProvider.completeNewPassword as jest.Mock).mockResolvedValue(MOCK_TOKENS);

      const result = await service.completeNewPassword('admin@test.com', 'NewPass123!', 'session-abc');

      expect(result.dto.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  // ── refreshSession ────────────────────────────────────────────────────────────

  describe('refreshSession()', () => {
    it('should return new tokens from provider', async () => {
      (mockProvider.refreshSession as jest.Mock).mockResolvedValue({
        ...MOCK_TOKENS,
        refreshToken: undefined,
      });

      const result = await service.refreshSession('refresh-token');

      expect(result.dto.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeUndefined();
      expect(mockProvider.refreshSession).toHaveBeenCalledWith('refresh-token');
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('should delegate to provider and return message dto', async () => {
      (mockProvider.forgotPassword as jest.Mock).mockResolvedValue(undefined);

      const result = await service.forgotPassword('admin@test.com');

      expect(result.message).toBe('Password reset code sent to email');
      expect(mockProvider.forgotPassword).toHaveBeenCalledWith('admin@test.com');
    });
  });

  // ── confirmForgotPassword ─────────────────────────────────────────────────────

  describe('confirmForgotPassword()', () => {
    it('should delegate to provider and return message dto', async () => {
      (mockProvider.confirmForgotPassword as jest.Mock).mockResolvedValue(undefined);

      const result = await service.confirmForgotPassword('admin@test.com', '123456', 'NewPass123!');

      expect(result.message).toBe('Password reset successfully');
      expect(mockProvider.confirmForgotPassword).toHaveBeenCalledWith(
        'admin@test.com',
        '123456',
        'NewPass123!',
      );
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('should delegate to provider and return message dto', async () => {
      (mockProvider.changePassword as jest.Mock).mockResolvedValue(undefined);

      const result = await service.changePassword('access-token', 'OldPass123!', 'NewPass123!');

      expect(result.message).toBe('Password changed successfully');
      expect(mockProvider.changePassword).toHaveBeenCalledWith(
        'access-token',
        'OldPass123!',
        'NewPass123!',
      );
    });
  });

  // ── signOut ───────────────────────────────────────────────────────────────────

  describe('signOut()', () => {
    it('should delegate to provider and return message dto', async () => {
      (mockProvider.signOut as jest.Mock).mockResolvedValue(undefined);

      const result = await service.signOut('access-token');

      expect(result.message).toBe('Signed out successfully');
      expect(mockProvider.signOut).toHaveBeenCalledWith('access-token');
    });
  });
});
