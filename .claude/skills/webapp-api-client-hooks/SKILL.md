---
name: webapp-api-client-hooks
description: Add API client methods and React Query hooks for a domain in the webapp data-access layer. Use this when creating or extending packages/client-common/ with new API client methods, query hooks, or mutation hooks. Covers the typed fetch wrapper, Zod response parsing, query key conventions, cache invalidation patterns, and barrel exports.
---

# Adding API Client Methods + React Query Hooks

Canonical references:
- API client: `packages/client-common/src/infrastructure/api-clients/user-api.client.ts`
- Base client: `packages/client-common/src/infrastructure/api-clients/base-api.client.ts`
- Hooks: `packages/client-common/src/hooks/use-users.ts`
- Config: `packages/client-common/src/infrastructure/config.ts`
- Error: `packages/client-common/src/infrastructure/errors/api-error.ts`

---

## Required Information — Ask First

Before writing any code, confirm:

1. **Which domain?** (`user`, `order`, `product`, or a new domain)
2. **What backend endpoints exist?** (HTTP method + path, e.g. `GET /api/users/by-status`)
3. **What are the request/response types?** (from `@mma/contracts/{domain}`)
4. **Is this a new domain or extending an existing one?** (new domain needs a new client file + config URL)
5. **Which pagination style?** (cursor-based for DynamoDB domains, offset-based for Prisma domains)
6. **Which operations are queries (read) vs mutations (write)?**

---

## Ordered Implementation Steps

---

### Step 1 — Verify Contracts Exist

Every API client method needs Zod schemas and TypeScript types from `@mma/contracts/{domain}`.

Required:
- Response schema: e.g. `{entity}ResponseSchema` (Zod schema for parsing API responses)
- Response type: e.g. `{Entity}Response` (TypeScript type inferred from schema)
- Input types: e.g. `Create{Entity}Input`, `Update{Entity}Input`
- Paginated response schema: `paginatedResponseSchema({entity}ResponseSchema)` for cursor-based, or `offsetPaginatedResponseSchema({entity}ResponseSchema)` for offset-based

If missing, follow the **`add-contracts`** skill first.

---

### Step 2 — API Client (new domain)

**Skip this step if the domain API client already exists.**

File: `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`

#### 2a. Register the new domain URL in config

File: `packages/client-common/src/infrastructure/config.ts`

Add the new URL to the `ApiConfig` interface, defaults, and type:

```typescript
interface ApiConfig {
  userApiUrl: string;
  productApiUrl: string;
  orderApiUrl: string;
  {domain}ApiUrl: string;  // ← new
}

const defaults: ApiConfig = {
  // ... existing
  {domain}ApiUrl: 'http://localhost:{PORT}/api',  // ← use the port from §7.1 registry
};
```

#### 2b. Create the API client file

```typescript
import { apiRequest, apiRequestVoid } from './base-api.client';
import {
  {entity}ResponseSchema,
  type Create{Entity}Input,
  type {Entity}Response,
} from '@mma/contracts/{domain}';
import { type PaginatedResponse, paginatedResponseSchema } from '@mma/contracts/common';
import { getApiConfig } from '../config';

const paginated{Entity}sSchema = paginatedResponseSchema({entity}ResponseSchema);

const baseUrl = () => getApiConfig().{domain}ApiUrl;

export const {domain}ApiClient = {
  // methods added in Step 3
};
```

#### 2c. Update Providers to pass the new URL

File: `apps/webapp/src/app/layout.tsx`

Add the new `NEXT_PUBLIC_API_{DOMAIN}_URL` env var to the `apiConfig` prop:

```tsx
<Providers apiConfig={{
  // ... existing
  {domain}ApiUrl: process.env.NEXT_PUBLIC_API_{DOMAIN}_URL!,
}}>
```

---

### Step 3 — API Client Methods

File: `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`

Add methods to the domain API client object. Each method maps to one backend endpoint.

#### Query method (GET with response parsing)

```typescript
getById({entity}Id: string): Promise<{Entity}Response> {
  return apiRequest(baseUrl(), `/{domain}s/${encodeURIComponent({entity}Id)}`, {
    schema: {entity}ResponseSchema,
  });
},
```

#### List method — cursor-based (DynamoDB domains)

```typescript
listByStatus(params: {
  {entity}Status: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}): Promise<PaginatedResponse<{Entity}Response>> {
  return apiRequest(baseUrl(), '/{domain}s/by-status', {
    params: params as Record<string, string | number | undefined>,
    schema: paginated{Entity}sSchema,
  });
},
```

#### List method — offset-based (Prisma domains)

```typescript
listByStatus(params: {
  {entity}Status: string;
  page?: number;
  limit?: number;
}): Promise<OffsetPaginatedResponse<{Entity}Response>> {
  return apiRequest(baseUrl(), '/{domain}s/by-status', {
    params: params as Record<string, string | number | undefined>,
    schema: offsetPaginated{Entity}sSchema,
  });
},
```

#### Mutation method (POST/PATCH/DELETE)

```typescript
create(input: Create{Entity}Input): Promise<{Entity}Response> {
  return apiRequest(baseUrl(), '/{domain}s', {
    method: 'POST',
    body: input,
    schema: {entity}ResponseSchema,
  });
},

delete({entity}Id: string): Promise<void> {
  return apiRequestVoid(baseUrl(), `/{domain}s/${encodeURIComponent({entity}Id)}`, {
    method: 'DELETE',
  });
},
```

#### State-transition method (POST to sub-resource)

```typescript
activate({entity}Id: string): Promise<{Entity}Response> {
  return apiRequest(baseUrl(), `/{domain}s/${encodeURIComponent({entity}Id)}/activate`, {
    method: 'POST',
    schema: {entity}ResponseSchema,
  });
},
```

**API Client Rules:**
- Every method that returns data **must** pass a `schema` option for Zod runtime validation (Golden Rule #23).
- Use `apiRequest<T>` for methods that return a parsed body; use `apiRequestVoid` for `DELETE` / `204` endpoints.
- Always `encodeURIComponent()` path parameters to prevent injection.
- The `baseUrl()` function is called lazily (not at module level) so config can be set after import.
- Query params use `params` option — the base client builds the URL with `URLSearchParams`.
- Methods are properties of a const object (`export const {domain}ApiClient = { ... }`) — not a class.

---

### Step 4 — React Query Hooks

File: `packages/client-common/src/hooks/use-{domain}.ts`

Create one file per domain. Export individual named hooks — one per API client method.

#### Query hook (read)

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { {domain}ApiClient } from '../infrastructure/api-clients/{domain}-api.client';
import type { Create{Entity}Input } from '@mma/contracts/{domain}';

const {DOMAIN}_KEY = '{domain}s';

export function use{Entity}({entity}Id: string) {
  return useQuery({
    queryKey: [{DOMAIN}_KEY, {entity}Id],
    queryFn: () => {domain}ApiClient.getById({entity}Id),
    enabled: !!{entity}Id,
  });
}

export function use{Entity}sByStatus(params: {
  {entity}Status: string;
  limit?: number;
  // ... pagination params
}) {
  return useQuery({
    queryKey: [{DOMAIN}_KEY, 'by-status', params],
    queryFn: () => {domain}ApiClient.listByStatus(params),
  });
}
```

#### Mutation hook (write)

```typescript
export function useCreate{Entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Create{Entity}Input) => {domain}ApiClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{DOMAIN}_KEY] });
    },
  });
}
```

#### Mutation hook (action by ID)

```typescript
export function useActivate{Entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({entity}Id: string) => {domain}ApiClient.activate({entity}Id),
    onSuccess: (_, {entity}Id) => {
      queryClient.invalidateQueries({ queryKey: [{DOMAIN}_KEY, {entity}Id] });
      queryClient.invalidateQueries({ queryKey: [{DOMAIN}_KEY, 'by-status'] });
    },
  });
}
```

#### Mutation hook (delete)

```typescript
export function useDelete{Entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({entity}Id: string) => {domain}ApiClient.delete({entity}Id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{DOMAIN}_KEY] });
    },
  });
}
```

**Hook Rules:**
- Always add `'use client'` directive — hooks require React context.
- **Query key convention:** `['{domain}s', ...discriminators]`. The base key is the plural domain name.
  - Single entity: `['{domain}s', {entity}Id]`
  - List by filter: `['{domain}s', 'by-status', params]`
  - All lists: `['{domain}s']` (used for broad invalidation)
- **`enabled` guard:** Set `enabled: !!{entity}Id` on single-entity queries to avoid fetching with empty IDs.
- **Invalidation strategy:**
  - Create/delete: invalidate the broad key `['{domain}s']` to refresh all lists.
  - Update/action: invalidate both the specific entity key and the affected list key.
- **Never call `fetch()` directly** inside a hook — always delegate to the API client.
- Mutation hooks do not take parameters — the caller passes arguments to `.mutate()`.

---

### Step 5 — Barrel Exports

File: `packages/client-common/src/hooks/index.ts`

Export all hooks from the new domain file:

```typescript
export {
  use{Entity},
  use{Entity}sByStatus,
  useCreate{Entity},
  useDelete{Entity},
  useActivate{Entity},
  // ... all hooks
} from './use-{domain}';
```

**Rules:**
- Every hook must be individually named-exported from the barrel — not `export *`.
- The barrel file is the public API of the hooks package.
- New domain hooks are appended after existing exports, grouped by domain.

---

## Architecture Overview

```
Page / Component
  → useQuery / useMutation hook (packages/client-common/src/hooks/)
    → {domain}ApiClient method (packages/client-common/src/infrastructure/api-clients/)
      → apiRequest() base client (Zod parse + fetch + ApiError)
        → Backend REST API
```

- **Hooks** are React-specific (use `useQuery`, `useMutation`, `useQueryClient`).
- **API clients** are framework-agnostic (pure fetch + Zod — no React imports).
- **Base client** handles URL building, JSON serialization, error wrapping, and Zod parsing.
- **ApiError** class matches the backend's `{ statusCode, error, message }` shape.

---

## Quick Reference: Which Files Are Affected

| Change type | Files |
|---|---|
| New domain (first endpoint) | `config.ts` (URL), `{domain}-api.client.ts` (new file), `use-{domain}.ts` (new file), `hooks/index.ts` (barrel), `layout.tsx` (apiConfig prop) |
| New endpoint (existing domain) | `{domain}-api.client.ts` (new method), `use-{domain}.ts` (new hook), `hooks/index.ts` (barrel export) |
| New mutation (action) | `{domain}-api.client.ts` (new method), `use-{domain}.ts` (new mutation hook), `hooks/index.ts` (barrel export) |

---

## Common Mistakes to Avoid

- **Forgetting the `schema` option** — API responses won't be Zod-validated, defeating runtime type safety.
- **Using `apiRequest` for void endpoints** — `DELETE` / `204` endpoints must use `apiRequestVoid`.
- **Hardcoding the base URL** — always use `baseUrl()` which reads from `getApiConfig()`. Never hardcode `http://localhost:3000`.
- **Missing barrel export** — hooks not exported from `index.ts` won't be importable via `@mma/client-common`.
- **Broad invalidation on targeted mutations** — invalidating `['{domain}s']` refreshes every list query. For targeted mutations (activate, update), invalidate both the entity key and the relevant list key.
- **Forgetting `enabled` guard on single-entity queries** — without `enabled: !!id`, the query fires immediately with an empty ID.
- **Missing `encodeURIComponent()` on path params** — always encode to prevent path traversal.
