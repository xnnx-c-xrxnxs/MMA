import { signIn, getAccessToken } from '@old-st/e2e-helpers';

const baseUrl = `http://${process.env.HOST ?? 'localhost'}:${process.env.USER_SERVICE_PORT ?? '3000'}/api`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('User API E2E — Status Transitions', () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await signIn();
  });

  async function createTestUser(suffix: string) {
    const res = await api('POST', '/users', {
      email: `e2e-status-${suffix}-${Date.now()}@test.example.com`,
      firstName: 'E2EStatus',
      lastName: suffix,
    });
    expect(res.status).toBe(201);
    createdUserIds.push(res.data.userId);
    return res.data;
  }

  afterAll(async () => {
    for (const userId of createdUserIds) {
      try {
        await api('DELETE', `/users/${userId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /users/:userId/verify-email', () => {
    it('should verify email for a PENDING user', async () => {
      const user = await createTestUser('verify');
      expect(user.userStatus).toBe('PENDING');

      const res = await api('POST', `/users/${user.userId}/verify-email`);

      expect(res.status).toBe(200);
      expect(res.data.userStatus).toBe('PENDING');
    });

    it('should reject verify-email for already verified user', async () => {
      const user = await createTestUser('verify-dup');
      await api('POST', `/users/${user.userId}/verify-email`);

      const res = await api('POST', `/users/${user.userId}/verify-email`);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /users/:userId/activate', () => {
    it('should activate a PENDING user with verified email', async () => {
      const user = await createTestUser('activate');
      // PENDING → verify-email (still PENDING, emailVerified=true) → activate → ACTIVE
      await api('POST', `/users/${user.userId}/verify-email`);

      const res = await api('POST', `/users/${user.userId}/activate`);

      expect(res.status).toBe(200);
      expect(res.data.userStatus).toBe('ACTIVE');
    });
  });

  describe('POST /users/:userId/deactivate', () => {
    it('should deactivate an ACTIVE user', async () => {
      const user = await createTestUser('deactivate');
      await api('POST', `/users/${user.userId}/verify-email`);
      await api('POST', `/users/${user.userId}/activate`);

      const res = await api('POST', `/users/${user.userId}/deactivate`);

      expect(res.status).toBe(200);
      expect(res.data.userStatus).toBe('INACTIVE');
    });

    it('should reject deactivating an already INACTIVE user', async () => {
      const user = await createTestUser('deactivate-already');
      // PENDING → deactivate → INACTIVE → deactivate again → 409
      await api('POST', `/users/${user.userId}/deactivate`);

      const res = await api('POST', `/users/${user.userId}/deactivate`);
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /users/:userId/role', () => {
    it('should update user role', async () => {
      const user = await createTestUser('role');
      await api('POST', `/users/${user.userId}/verify-email`);

      const res = await api('PATCH', `/users/${user.userId}/role`, {
        userRole: 'ADMIN',
      });

      expect(res.status).toBe(200);
      expect(res.data.userRole).toBe('ADMIN');
    });
  });
});
