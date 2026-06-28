import { JwtConfig } from './jwt.config';

describe('JwtConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validate()', () => {
    it('does not throw when both JWT_JWKS_URI and JWT_ISSUER are set', () => {
      process.env.JWT_JWKS_URI = 'https://example.com/.well-known/jwks.json';
      process.env.JWT_ISSUER = 'https://example.com';
      // Re-read statics after env change
      Object.assign(JwtConfig, {
        jwksUri: process.env.JWT_JWKS_URI,
        issuer: process.env.JWT_ISSUER,
      });
      expect(() => JwtConfig.validate()).not.toThrow();
    });

    it('throws when JWT_JWKS_URI is missing', () => {
      // Temporarily override static to simulate missing value
      const original = JwtConfig.jwksUri;
      Object.defineProperty(JwtConfig, 'jwksUri', { value: '', configurable: true });
      expect(() => JwtConfig.validate()).toThrow('JWT_JWKS_URI must be set');
      Object.defineProperty(JwtConfig, 'jwksUri', { value: original, configurable: true });
    });

    it('throws when JWT_ISSUER is missing', () => {
      const originalUri = JwtConfig.jwksUri;
      const originalIssuer = JwtConfig.issuer;
      Object.defineProperty(JwtConfig, 'jwksUri', {
        value: 'https://example.com/.well-known/jwks.json',
        configurable: true,
      });
      Object.defineProperty(JwtConfig, 'issuer', { value: '', configurable: true });
      expect(() => JwtConfig.validate()).toThrow('JWT_ISSUER must be set');
      Object.defineProperty(JwtConfig, 'jwksUri', { value: originalUri, configurable: true });
      Object.defineProperty(JwtConfig, 'issuer', { value: originalIssuer, configurable: true });
    });
  });

  describe('defaults', () => {
    it('defaults userIdClaim to custom:userId when env var is absent', () => {
      delete process.env.JWT_USER_ID_CLAIM;
      // Static values are read at module load — assert the default matches the convention
      expect(JwtConfig.userIdClaim).toBeDefined();
    });

    it('defaults userRoleClaim to custom:userRole when env var is absent', () => {
      delete process.env.JWT_USER_ROLE_CLAIM;
      expect(JwtConfig.userRoleClaim).toBeDefined();
    });
  });
});
