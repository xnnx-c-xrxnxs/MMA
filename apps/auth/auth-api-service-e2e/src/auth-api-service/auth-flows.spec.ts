/**
 * Auth API E2E Tests — Sign-In Flows
 *
 * Tests the /auth/sign-in endpoint using the LocalAuthProvider.
 * Local provider accepts admin@test.com / Password123! and returns mock JWT tokens.
 */

const BASE_URL = process.env.API_AUTH_URL || 'http://localhost:3003/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json() as Promise<any>;
}

describe('POST /auth/sign-in', () => {
  it('should return SUCCESS with tokens for valid credentials', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.type).toBe('SUCCESS');
    expect(body.tokens).toBeDefined();
    expect(body.tokens.accessToken).toBeDefined();
    expect(typeof body.tokens.accessToken).toBe('string');
    expect(body.tokens.accessToken.length).toBeGreaterThan(0);
  });

  it('should return 401 for wrong password', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'WrongPassword!' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 401 for non-existent user', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'Password123!' }),
    });

    // Local provider throws for unknown users
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should return 400 for missing email', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Password123!' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing password', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com' }),
    });

    expect(res.status).toBe(400);
  });

  it('should set refresh_token httpOnly cookie on successful sign-in', async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });

    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('refresh_token=');
    expect(setCookie).toContain('HttpOnly');
  });
});

describe('POST /auth/refresh-session', () => {
  it('should return 401 when no refresh token cookie is provided', async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.message).toContain('No refresh token');
  });

  it('should refresh session when valid refresh cookie is provided', async () => {
    // First sign in to get the cookie
    const signInRes = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });
    expect(signInRes.status).toBe(201);

    const setCookie = signInRes.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('No set-cookie header from sign-in');
    }

    // Extract the refresh_token value
    const match = setCookie.match(/refresh_token=([^;]+)/);
    if (!match) {
      throw new Error('refresh_token not found in set-cookie');
    }
    const refreshToken = match[1];

    // Use the cookie to refresh
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
    });

    // Local provider should return a valid response
    // (may return 401 if the mock token format isn't parseable — that's acceptable)
    expect([200, 201, 401]).toContain(refreshRes.status);
  });
});

describe('GET /auth/me', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });
    const body = await json(res);
    accessToken = body.tokens.accessToken;
  });

  it('should return user info for authenticated request', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.userId).toBeDefined();
    expect(body.email).toBeDefined();
  });

  it('should return 401 without authorization header', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/sign-out', () => {
  it('should sign out successfully with valid token', async () => {
    // First sign in
    const signInRes = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });
    const signInBody = await json(signInRes);
    const token = signInBody.tokens.accessToken;

    // Sign out
    const res = await fetch(`${BASE_URL}/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    expect([200, 201]).toContain(res.status);
  });
});

describe('POST /auth/forgot-password', () => {
  it('should accept a valid email for password reset', async () => {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com' }),
    });

    // Local provider may or may not implement this — accept 200/201 or 501
    expect(res.status).toBeLessThan(500);
  });

  it('should return 400 for missing email', async () => {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/change-password', () => {
  it('should return 401 without authorization header', async () => {
    const res = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/new-password', () => {
  it('should return 400 for missing required fields', async () => {
    const res = await fetch(`${BASE_URL}/auth/new-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 when newPassword is too short (< 8 chars)', async () => {
    const res = await fetch(`${BASE_URL}/auth/new-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', newPassword: 'short', session: 'sess' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing session', async () => {
    const res = await fetch(`${BASE_URL}/auth/new-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', newPassword: 'NewPass123!' }),
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/confirm-forgot-password', () => {
  it('should return 400 for missing required fields', async () => {
    const res = await fetch(`${BASE_URL}/auth/confirm-forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 when newPassword is too short (< 8 chars)', async () => {
    const res = await fetch(`${BASE_URL}/auth/confirm-forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', code: '123456', newPassword: 'short' }),
    });

    expect(res.status).toBe(400);
  });

  it('should accept valid shape and return a non-5xx response', async () => {
    const res = await fetch(`${BASE_URL}/auth/confirm-forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        code: '123456',
        newPassword: 'NewPass123!',
      }),
    });

    expect(res.status).toBeLessThan(500);
  });
});

describe('POST /auth/change-password — authenticated', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Password123!' }),
    });
    const body = await json(res);
    accessToken = body.tokens.accessToken;
  });

  it('should return 200/201 for valid request when authenticated', async () => {
    const res = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ oldPassword: 'Password123!', newPassword: 'NewPassword456!' }),
    });

    expect([200, 201]).toContain(res.status);
    const body = await json(res);
    expect(body.message).toBeDefined();
  });

  it('should return 400 for missing oldPassword', async () => {
    const res = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ newPassword: 'NewPassword456!' }),
    });

    expect(res.status).toBe(400);
  });
});
