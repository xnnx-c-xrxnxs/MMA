---
name: write-client-common-tests
description: Write unit tests for the shared data-access layer (@mma/client-common) including API clients, React Query hooks, error classes, and configuration. Use this when adding tests for new or existing code in packages/client-common/.
---

# Writing client-common Tests

Canonical references:
- `packages/client-common/src/infrastructure/api-clients/base-api.client.spec.ts`
- `packages/client-common/src/infrastructure/api-clients/user-api.client.spec.ts`
- `packages/client-common/src/hooks/use-users.spec.ts`
- `packages/client-common/src/infrastructure/errors/api-error.spec.ts`

Tests are co-located with their source files (`.spec.ts` / `.spec.tsx` next to source).

---

## What Gets Tested and Where

| Layer | Test file location | What to test |
|---|---|---|
| Base API client | `infrastructure/api-clients/base-api.client.spec.ts` | fetch calls, Zod schema parsing, error mapping, 204 handling |
| Domain API clients | `infrastructure/api-clients/{domain}-api.client.spec.ts` | URL construction, method delegation, body/params passing |
| React Query hooks | `hooks/use-{domain}.spec.ts` | Query key, enabled flag, mutation + invalidation |
| ApiError class | `infrastructure/errors/api-error.spec.ts` | Constructor, status code getters |
| Config module | `infrastructure/config.spec.ts` | Default values, partial overrides, merge behavior |
| QueryClient factory | `lib/query-client.spec.ts` | Default options, singleton behavior |

---

## Test Config (jest.config.ts)

```typescript
export default {
  displayName: 'client-common',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/client-common',
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
```

---

## Base API Client Tests

The base client wraps `fetch` with typed error handling and optional Zod schema parsing.

### Mock `globalThis.fetch`

```typescript
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

afterEach(() => jest.resetAllMocks());
```

### Test patterns

```typescript
import { apiRequest, apiRequestVoid } from './base-api.client';
import { ApiError } from '../errors/api-error';
import { z } from 'zod';

describe('apiRequest', () => {
  it('sends GET request to the correct URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: '1' }),
    });

    const result = await apiRequest('/users/1', { method: 'GET' });

    expect(mockFetch).toHaveBeenCalledWith('/users/1', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({ id: '1' });
  });

  it('applies Zod schema to response', async () => {
    const schema = z.object({ id: z.string() });
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: '1', extra: 'field' }),
    });

    const result = await apiRequest('/users/1', { method: 'GET', schema });

    expect(result).toEqual({ id: '1' }); // 'extra' stripped by schema
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ statusCode: 404, error: 'NotFound', message: 'not found' }),
    });

    await expect(apiRequest('/users/missing', { method: 'GET' })).rejects.toThrow(ApiError);
  });

  it('returns undefined for 204 responses', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await apiRequest('/users/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });
});

describe('apiRequestVoid', () => {
  it('sends request and returns void', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(apiRequestVoid('/users/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ statusCode: 500, error: 'Internal', message: 'fail' }),
    });

    await expect(apiRequestVoid('/users/1', { method: 'DELETE' })).rejects.toThrow(ApiError);
  });
});
```

**Base client test checklist:**
- [ ] GET request with correct URL and headers
- [ ] POST request with JSON body
- [ ] Query params appended (undefined values omitted)
- [ ] Zod schema.parse applied to response
- [ ] Non-OK → ApiError thrown with statusCode, error, message
- [ ] 204 → returns undefined
- [ ] apiRequestVoid success
- [ ] apiRequestVoid error

---

## Domain API Client Tests

Domain clients delegate to `apiRequest`/`apiRequestVoid`. Mock the base client module:

```typescript
jest.mock('./base-api.client', () => ({
  apiRequest: jest.fn(),
  apiRequestVoid: jest.fn(),
}));

import { apiRequest, apiRequestVoid } from './base-api.client';
import { userApiClient } from './user-api.client';

const mockApiRequest = apiRequest as jest.Mock;
const mockApiRequestVoid = apiRequestVoid as jest.Mock;

describe('userApiClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create() sends POST with body', async () => {
    mockApiRequest.mockResolvedValue({ userId: 'u-1' });
    const input = { email: 'test@test.com', firstName: 'Test', lastName: 'User' };

    await userApiClient.create(input);

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/v1/users'),
      expect.objectContaining({ method: 'POST', body: input }),
    );
  });

  it('getById() sends GET with userId in URL', async () => {
    mockApiRequest.mockResolvedValue({ userId: 'u-1' });

    await userApiClient.getById('u-1');

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/v1/users/u-1'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('delete() sends DELETE and calls apiRequestVoid', async () => {
    mockApiRequestVoid.mockResolvedValue(undefined);

    await userApiClient.delete('u-1');

    expect(mockApiRequestVoid).toHaveBeenCalledWith(
      expect.stringContaining('/v1/users/u-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
```

**Domain client test checklist:**
- [ ] Each method sends the correct HTTP method (GET/POST/PATCH/DELETE)
- [ ] URL contains the entity ID where applicable
- [ ] Request body is passed for POST/PATCH
- [ ] Query params are passed for list endpoints
- [ ] Void methods use `apiRequestVoid`

---

## React Query Hook Tests

Hooks wrap domain API clients with React Query. Test using `renderHook` + `QueryClientProvider`.

### Test wrapper

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

### Query hook tests

```typescript
jest.mock('../../infrastructure/api-clients/user-api.client', () => ({
  userApiClient: {
    getById: jest.fn(),
    listByStatus: jest.fn(),
  },
}));

import { userApiClient } from '../../infrastructure/api-clients/user-api.client';
import { useUser, useUsersByStatus } from './use-users';

describe('useUser', () => {
  it('fetches user by ID', async () => {
    (userApiClient.getById as jest.Mock).mockResolvedValue({ userId: 'u-1' });

    const { result } = renderHook(() => useUser('u-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ userId: 'u-1' });
    expect(userApiClient.getById).toHaveBeenCalledWith('u-1');
  });

  it('is disabled when userId is undefined', () => {
    const { result } = renderHook(() => useUser(undefined), { wrapper: createWrapper() });

    expect(result.current.isFetching).toBe(false);
  });
});
```

### Mutation hook tests

```typescript
import { useCancelOrder } from './use-orders';

describe('useCancelOrder', () => {
  it('calls cancel API on mutate', async () => {
    (orderApiClient.cancel as jest.Mock).mockResolvedValue({});

    const { result } = renderHook(() => useCancelOrder(), { wrapper: createWrapper() });

    result.current.mutate('ord-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orderApiClient.cancel).toHaveBeenCalledWith('ord-1');
  });
});
```

**Hook test checklist:**
- [ ] Query hook fetches with correct API client method and args
- [ ] Query hook is disabled when ID param is undefined/empty
- [ ] Mutation hook calls correct API method
- [ ] `enabled` flag is respected

---

## ApiError Class Tests

```typescript
import { ApiError } from './api-error';

describe('ApiError', () => {
  const error = new ApiError(404, 'NotFound', 'User not found');

  it('stores statusCode, error, and message', () => {
    expect(error.statusCode).toBe(404);
    expect(error.error).toBe('NotFound');
    expect(error.message).toBe('User not found');
  });

  it('is an instance of Error', () => {
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    ['isNotFound', 404, true],
    ['isNotFound', 409, false],
    ['isConflict', 409, true],
    ['isBadRequest', 400, true],
    ['isServerError', 500, true],
    ['isServerError', 503, true],
  ] as const)('%s returns %s for status %s', (getter, status, expected) => {
    const e = new ApiError(status, 'E', 'm');
    expect((e as any)[getter]).toBe(expected);
  });
});
```

---

## Config Module Tests

```typescript
import { configureApi, getApiConfig } from './config';

describe('configureApi', () => {
  it('returns default values before configuration', () => {
    const config = getApiConfig();
    expect(config.userApiUrl).toBeDefined();
  });

  it('overrides values when configured', () => {
    configureApi({ userApiUrl: 'http://custom:3000/api' });
    expect(getApiConfig().userApiUrl).toBe('http://custom:3000/api');
  });

  it('merges partial overrides', () => {
    configureApi({ userApiUrl: 'http://custom/api' });
    const config = getApiConfig();
    expect(config.userApiUrl).toBe('http://custom/api');
    expect(config.productApiUrl).toBeDefined(); // other defaults unchanged
  });
});
```

---

## Running Tests

```bash
# Run all client-common tests
npx nx test client-common

# Run with coverage
npx nx test client-common --coverage

# Run a single spec file
npx nx test client-common --testFile=src/hooks/use-users.spec.ts
```

---

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Not resetting `globalThis.fetch` mock | Use `afterEach(() => jest.resetAllMocks())` |
| Forgetting `QueryClientProvider` wrapper for hooks | Always wrap hooks with `createWrapper()` |
| Using `retry: true` in test QueryClient | Set `retry: false` and `gcTime: 0` to prevent flaky async behavior |
| Testing hook internals instead of behavior | Assert on `result.current.data` and API client mock calls |
| Not mocking the config module when base URL changes | Reset config between tests or mock `getApiConfig` |
