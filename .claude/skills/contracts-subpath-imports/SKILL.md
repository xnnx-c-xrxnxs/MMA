---
name: contracts-subpath-imports
description: Enforce domain-scoped imports from @old-st/contracts to prevent transitive type coupling between domains. Use this when adding new contracts packages, updating imports, or reviewing code that imports from @old-st/contracts.
---

# Contracts Domain-Scoped Imports — Domain Isolation Rule

## Problem

If all domains shared a single contracts package, TypeScript would resolve the **entire** transitive type graph — all domains, all their infrastructure — even if a service only uses one domain's schemas.

**Result:** A type error in **any** domain would break **every** service that imports from the shared package.

---

## Solution: Independent Per-Domain Contracts Packages

Each domain has its own contracts package under `packages/contracts/{domain}/`, with its own `package.json`, `project.json`, and `tsconfig.json`. There is **no root contracts package** — only per-domain packages.

The import specifier `@old-st/contracts/{domain}` is resolved by a `tsconfig.base.json` path alias that points to `packages/contracts/{domain}/src/index.ts`.

```typescript
// CORRECT — isolated, only pulls user-domain types
import { create{Entity}Schema, {Entity}Response } from '@old-st/contracts/{domain}';
import { PaginatedResponse } from '@old-st/contracts/common';

// CORRECT — isolated, only pulls product-domain types
import { {entity}ResponseSchema } from '@old-st/contracts/{domain}';

// CORRECT — isolated, only pulls order-domain types
// Other domains follow the same pattern:
// import { otherEntityResponseSchema } from '@old-st/contracts/{otherDomain}';
```

```typescript
// FORBIDDEN — no root @old-st/contracts package exists
import { createUserSchema } from '@old-st/contracts';
```

---

## Available Packages

| Import specifier | Package path | Contains |
|---|---|---|
| `@old-st/contracts/common` | `packages/contracts/common/` | `PaginatedResponse`, `paginatedResponseSchema`, `createPaginatedResponse` |
| `@old-st/contracts/{domain}` | `packages/contracts/{domain}/` | Domain-specific schemas, types, event schemas, re-exported domain constants |
| `@old-st/contracts/auth` | `packages/contracts/auth/` | Auth schemas (sign-in, refresh, password flows, discriminated unions for Cognito challenges) |

Each package has its own `package.json` (with its own `dependencies`), `project.json` (Nx tags: `scope:{domain}`, `type:contracts`), and `tsconfig.json`.

---

## Rules (Always Enforced)

1. **Services MUST import from `@old-st/contracts/{domain}`** — never from a bare `@old-st/contracts` root (which does not exist).
2. **Shared types** (`PaginatedResponse`, `paginatedResponseSchema`) must be imported from `@old-st/contracts/common`.
3. **Each service imports ONLY its own domain's contracts package** plus `common`. A `{domain}-api-service` must never import from another domain's contracts package.
4. **Event schemas** (`{domain}DomainEventSchema`, `{Domain}EventTypeEnum`) live in `@old-st/contracts/{domain}` (exported from `event-schemas.ts` via the domain barrel).
5. **New domains** must add a new, independent contracts package — see steps below.

---

## Adding a New Domain's Contracts Package

### 1. Create the package directory

```
packages/contracts/{domain}/
  package.json
  project.json
  tsconfig.json
  src/
    index.ts
    schemas.ts
```

### 2. Create `packages/contracts/{domain}/package.json`

```json
{
  "name": "@old-st/contracts-{domain}",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@old-st/{domain}-domain": "*",
    "zod": "^3.24.4"
  }
}
```

Add any other workspace dependencies the domain's contracts need (e.g., `@old-st/contracts-common` if it re-exports common types).

### 3. Create `packages/contracts/{domain}/project.json`

```json
{
  "name": "contracts-{domain}",
  "tags": ["scope:{domain}", "type:contracts"]
}
```

### 4. Create `packages/contracts/{domain}/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### 5. Create barrel file `packages/contracts/{domain}/src/index.ts`

```typescript
export * from './schemas';
// export * from './event-schemas';  ← add when event schemas exist
```

### 6. Add path alias to `tsconfig.base.json`

```json
{
  "paths": {
    "@old-st/contracts/{domain}": ["packages/contracts/{domain}/src/index.ts"]
  }
}
```

### 7. Install dependencies

Run `pnpm install` from the workspace root so the new package's dependencies are linked.

### 8. Use the import specifier in services

```typescript
// In apps/{domain}/{service}/src/application/services/*.ts
import { {entity}ResponseSchema, Create{Entity}Input } from '@old-st/contracts/{domain}';
import { PaginatedResponse } from '@old-st/contracts/common';

// In apps/{domain}/{service}/src/presentation/controllers/*.ts
import { create{Entity}Schema, Create{Entity}Input } from '@old-st/contracts/{domain}';
```

---

## Why This Matters

Each per-domain contracts package is a **separate compilation unit**. `tsconfig.base.json` maps `@old-st/contracts/{domain}` to `packages/contracts/{domain}/src/index.ts`, so TypeScript only resolves the types for that one domain. A `TS2345` in order contracts cannot break user-api-service because their type graphs are completely disjoint.

This per-package isolation also means each domain's contracts can declare its own `dependencies` in `package.json` — a contracts package only depends on its own domain package (`@old-st/{domain}-domain`), preventing accidental cross-domain coupling at the dependency level too.
