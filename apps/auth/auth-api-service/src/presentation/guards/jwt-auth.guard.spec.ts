import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

// Mock jsonwebtoken and jwks-rsa so tests don't make real JWKS network calls
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

// Mock JwtConfig so tests don't need real env vars
jest.mock('../../infrastructure/config/jwt.config', () => ({
  JwtConfig: {
    jwksUri: 'https://example.auth.com/.well-known/jwks.json',
    issuer: 'https://example.auth.com',
    userIdClaim: 'custom:userId',
    userRoleClaim: 'custom:userRole',
    validate: jest.fn(),
  },
}));

import * as jwt from 'jsonwebtoken';

const mockJwtVerify = jwt.verify as jest.Mock;

function mockPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-sub',
    email: 'admin@test.com',
    'custom:userId': 'user-id-1',
    'custom:userRole': 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    token_use: 'access',
    ...overrides,
  };
}

function buildContext(headers: Record<string, string | undefined> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers, user: undefined }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(isLocal: boolean) {
  const originalStage = process.env.STAGE;
  process.env.STAGE = isLocal ? 'local' : 'production';
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const guard = new JwtAuthGuard(reflector);
  process.env.STAGE = originalStage;
  return { guard, reflector };
}

// Build a minimal local mock token (header.payload.signature)
function buildLocalToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('JwtAuthGuard — local mode (STAGE=local)', () => {
  const { guard, reflector } = (() => {
    const originalStage = process.env.STAGE;
    process.env.STAGE = 'local';
    const r = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const g = new JwtAuthGuard(r);
    process.env.STAGE = originalStage;
    return { guard: g, reflector: r };
  })();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to not-public so each test starts clean
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
  });

  it('should allow @Public() routes without a token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should reject requests with no Authorization header', async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests with malformed Authorization header', async () => {
    const ctx = buildContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should accept a valid local mock token and populate request.user', async () => {
    const payload = mockPayload();
    const token = buildLocalToken(payload);
    const request = { headers: { authorization: `Bearer ${token}` } };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request as any).user).toEqual({
      userId: 'user-id-1',
      email: 'admin@test.com',
      userRole: 'ADMIN',
    });
  });

  it('should fall back to sub when userIdClaim is missing from token', async () => {
    const payload = mockPayload({ 'custom:userId': undefined, sub: 'fallback-sub' });
    const token = buildLocalToken(payload);
    const request = { headers: { authorization: `Bearer ${token}` } };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);
    expect((request as any).user.userId).toBe('fallback-sub');
  });

  it('should reject an expired local token', async () => {
    const payload = mockPayload({ exp: Math.floor(Date.now() / 1000) - 100 });
    const token = buildLocalToken(payload);
    const ctx = buildContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

describe('JwtAuthGuard — deployed mode (STAGE=production)', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    const originalStage = process.env.STAGE;
    process.env.STAGE = 'production';
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    guard = new JwtAuthGuard(reflector);
    process.env.STAGE = originalStage;
  });

  it('should call jwt.verify with the token and resolve on success', async () => {
    const payload = mockPayload();
    mockJwtVerify.mockImplementation(
      (_token: string, _getKey: unknown, _options: unknown, callback: (err: Error | null, decoded: unknown) => void) => {
        callback(null, payload);
      },
    );

    const request = { headers: { authorization: 'Bearer valid.token.here' } };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockJwtVerify).toHaveBeenCalledWith(
      'valid.token.here',
      expect.any(Function),
      expect.objectContaining({ issuer: 'https://example.auth.com', algorithms: ['RS256'] }),
      expect.any(Function),
    );
  });

  it('should throw UnauthorizedException when jwt.verify fails', async () => {
    mockJwtVerify.mockImplementation(
      (_token: string, _getKey: unknown, _options: unknown, callback: (err: Error | null, decoded: unknown) => void) => {
        callback(new Error('JWTExpired'), null);
      },
    );

    const ctx = buildContext({ authorization: 'Bearer tampered.token.here' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
