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

describe('User API E2E — Filtering & Pagination', () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await signIn();
  });

  async function createAndActivateUser(suffix: string) {
    const res = await api('POST', '/users', {
      email: `e2e-filter-${suffix}-${Date.now()}@test.example.com`,
      firstName: 'E2EFilter',
      lastName: suffix,
    });
    createdUserIds.push(res.data.userId);
    await api('POST', `/users/${res.data.userId}/verify-email`);
    await api('POST', `/users/${res.data.userId}/activate`);
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

  describe('GET /users/by-status', () => {
    it('should return active users', async () => {
      const user1 = await createAndActivateUser('active1');
      const user2 = await createAndActivateUser('active2');

      const res = await api('GET', '/users/by-status?userStatus=ACTIVE&limit=10');

      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.data.length).toBeGreaterThanOrEqual(2);

      // Verify our created users are in the results with ACTIVE status
      // (other tests may leave stale GSI entries due to DynamoDB eventual consistency)
      const ourUserIds = [user1.userId, user2.userId];
      const ourUsers = res.data.data.filter((u: { userId: string }) =>
        ourUserIds.includes(u.userId)
      );
      expect(ourUsers.length).toBe(2);
      for (const user of ourUsers) {
        expect(user.userStatus).toBe('ACTIVE');
      }
    });

    it('should support cursor-based pagination', async () => {
      // Create enough users to paginate
      for (let i = 0; i < 3; i++) {
        await createAndActivateUser(`page${i}`);
      }

      const firstPage = await api('GET', '/users/by-status?userStatus=ACTIVE&limit=2');

      expect(firstPage.status).toBe(200);
      expect(firstPage.data.data.length).toBeLessThanOrEqual(2);

      if (firstPage.data.nextCursorPointer) {
        const params = new URLSearchParams({
          userStatus: 'ACTIVE',
          limit: '2',
          cursor: JSON.stringify(firstPage.data.nextCursorPointer),
          direction: 'next',
        });
        const secondPage = await api('GET', `/users/by-status?${params}`);

        expect(secondPage.status).toBe(200);
        expect(secondPage.data.data).toBeDefined();
      }
    });
  });

  describe('GET /users/by-role-and-status', () => {
    it('should filter by role and status', async () => {
      const created = await createAndActivateUser('rolefilter');

      const res = await api('GET', '/users/by-role-and-status?userRole=USER&userStatus=ACTIVE&limit=10');

      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      expect(Array.isArray(res.data.data)).toBe(true);

      // Only assert on the user we created — other tests may leave stale GSI
      // entries for users that have since been deleted or had their status changed.
      const our = res.data.data.find((u: { userId: string }) => u.userId === created.userId);
      expect(our).toBeDefined();
      expect(our.userRole).toBe('USER');
      expect(our.userStatus).toBe('ACTIVE');
    });
  });

  describe('GET /users (by email)', () => {
    it('should find user by email', async () => {
      const email = `e2e-byemail-${Date.now()}@test.example.com`;
      const createRes = await api('POST', '/users', {
        email,
        firstName: 'ByEmail',
        lastName: 'Lookup',
      });
      createdUserIds.push(createRes.data.userId);

      const res = await api('GET', `/users?email=${encodeURIComponent(email)}`);

      expect(res.status).toBe(200);
      expect(res.data.email).toBe(email);
    });
  });
});
