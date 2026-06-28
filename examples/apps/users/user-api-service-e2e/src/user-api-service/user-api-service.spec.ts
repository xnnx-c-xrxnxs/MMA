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

describe('User API E2E — CRUD', () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await signIn();
  });

  afterAll(async () => {
    // Cleanup: delete all users created during tests
    for (const userId of createdUserIds) {
      try {
        await api('DELETE', `/users/${userId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const input = {
        email: `e2e-crud-${Date.now()}@test.example.com`,
        firstName: 'E2ECrud',
        lastName: 'TestUser',
      };

      const res = await api('POST', '/users', input);

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        userRole: 'USER',
        userStatus: 'PENDING',
      });
      expect(res.data.userId).toBeDefined();
      expect(res.data.dateCreated).toBeDefined();

      createdUserIds.push(res.data.userId);
    });

    it('should reject duplicate email', async () => {
      const email = `e2e-dup-${Date.now()}@test.example.com`;
      const input = { email, firstName: 'Dup', lastName: 'User' };

      const first = await api('POST', '/users', input);
      expect(first.status).toBe(201);
      createdUserIds.push(first.data.userId);

      const second = await api('POST', '/users', input);
      expect(second.status).toBe(409);
    });

    it('should reject invalid email', async () => {
      const res = await api('POST', '/users', {
        email: 'not-an-email',
        firstName: 'Bad',
        lastName: 'Email',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /users/:userId', () => {
    it('should return a created user by ID', async () => {
      const input = {
        email: `e2e-get-${Date.now()}@test.example.com`,
        firstName: 'E2EGet',
        lastName: 'User',
      };
      const created = await api('POST', '/users', input);
      createdUserIds.push(created.data.userId);

      const res = await api('GET', `/users/${created.data.userId}`);

      expect(res.status).toBe(200);
      expect(res.data.userId).toBe(created.data.userId);
      expect(res.data.email).toBe(input.email);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await api('GET', '/users/non-existent-id-12345');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /users/:userId', () => {
    it('should update user profile fields', async () => {
      const input = {
        email: `e2e-update-${Date.now()}@test.example.com`,
        firstName: 'Before',
        lastName: 'Update',
      };
      const created = await api('POST', '/users', input);
      createdUserIds.push(created.data.userId);

      const res = await api('PATCH', `/users/${created.data.userId}`, {
        firstName: 'After',
        lastName: 'Updated',
      });

      expect(res.status).toBe(200);
      expect(res.data.firstName).toBe('After');
      expect(res.data.lastName).toBe('Updated');
    });
  });

  describe('DELETE /users/:userId', () => {
    it('should delete a user', async () => {
      const input = {
        email: `e2e-delete-${Date.now()}@test.example.com`,
        firstName: 'ToDelete',
        lastName: 'User',
      };
      const created = await api('POST', '/users', input);

      const deleteRes = await api('DELETE', `/users/${created.data.userId}`);
      expect([200, 204]).toContain(deleteRes.status);

      // Verify soft-deleted — user still returned with DELETED status
      const getRes = await api('GET', `/users/${created.data.userId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data.userStatus).toBe('DELETED');
    });
  });
});
