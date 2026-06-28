---
name: add-contracts
description: Add Zod validation schemas and TypeScript types for a domain entity to its contracts package (packages/contracts/{domain}/src/schemas.ts). Use this when exposing a domain entity through an API, adding new request/response validation, or updating existing contracts after domain changes.
---

# Adding Contracts for a Domain

Contracts are the shared source of truth for API input/output shapes, validated with Zod. Each domain has its own contracts package under `packages/contracts/{domain}/` with an independent `package.json`, `project.json`, and `tsconfig.json`. They are consumed by NestJS controllers (for validation) and application services (for DTO transformation).

---

## File Location

```
packages/contracts/{domain}/src/schemas.ts
packages/contracts/{domain}/src/index.ts   ← barrel
```

---

## Contracts Schema Template

```typescript
import { z } from 'zod';
import {
  {ENTITY}_STATUSES,
  {ENTITY}_ROLES,          // include only if entity has roles
  {Entity}StatusEnum,
  {Entity}RoleEnum,
} from '@old-st/{domain}-domain';

// ── Re-export domain constants ──────────────────────────────────────────────
export { {ENTITY}_STATUSES, {Entity}StatusEnum };

// ── Enum schemas ─────────────────────────────────────────────────────────────
export const {entity}StatusSchema = z.enum({ENTITY}_STATUSES);
export const {entity}RoleSchema   = z.enum({ENTITY}_ROLES);    // include only if needed

// ── Create Input ─────────────────────────────────────────────────────────────
export const create{Entity}Schema = z.object({
  field1: z.string().min(1).max(100),
  field2: z.string().min(1).max(100),
  {entity}Status: {entity}StatusSchema.optional().default('{DEFAULT_STATUS}'),
  data: z.object({ country: z.string().optional() }).optional(),
});

// ── Update Input (all fields optional) ───────────────────────────────────────
export const update{Entity}Schema = z.object({
  field1: z.string().min(1).max(100).optional(),
  field2: z.string().min(1).max(100).optional(),
});

// ── Response Schema (API output) ─────────────────────────────────────────────
export const {entity}ResponseSchema = z.object({
  {entity}Id:    z.string(),
  field1:        z.string(),
  field2:        z.string(),
  {entity}Status: {entity}StatusSchema,
  dateCreated:   z.string().datetime(),
  updatedAt:     z.string().datetime(),
});

// ── Path Parameter Schemas ────────────────────────────────────────────────────
export const get{Entity}ByIdSchema = z.object({
  {entity}Id: z.string(),
});

// ── Query Schemas — use z.coerce.number() for numeric query params ────────────
// Query parameters arrive as strings from HTTP. Use z.coerce.number() to convert.

// DynamoDB domains — cursor-based pagination:
export const list{Entities}ByStatusSchema = z.object({
  {entity}Status: {entity}StatusSchema,
  limit:     z.coerce.number().min(1).max(100).optional().default(20),
  cursor:    z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

// Prisma domains — offset-based pagination:
export const list{Entities}ByStatusSchema = z.object({
  {entity}Status: {entity}StatusSchema,
  page:  z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// ── Paginated Response ────────────────────────────────────────────────────────
// DynamoDB domains — cursor-based:
// PaginatedResponse is already defined in @old-st/contracts/common — import it
export type PaginatedResponse<T> = {
  data: T[];
  nextCursorPointer: Record<string, unknown> | null;
  prevCursorPointer: Record<string, unknown> | null;
};

// Prisma domains — offset-based:
// OffsetPaginatedResponse is already defined in @old-st/contracts/common — import it
export type OffsetPaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ── TypeScript Type Exports ───────────────────────────────────────────────────
export type {Entity}Status        = z.infer<typeof {entity}StatusSchema>;
export type Create{Entity}Input   = z.infer<typeof create{Entity}Schema>;
export type Update{Entity}Input   = z.infer<typeof update{Entity}Schema>;
export type {Entity}Response      = z.infer<typeof {entity}ResponseSchema>;
export type Get{Entity}ByIdInput  = z.infer<typeof get{Entity}ByIdSchema>;
export type List{Entities}ByStatusInput = z.infer<typeof list{Entities}ByStatusSchema>;
```

---

## `z.coerce.number()` vs `z.number()` — Critical Distinction

| Location | Rule | Reason |
|---|---|---|
| Query parameter schemas (`@Query`) | `z.coerce.number()` | HTTP query params always arrive as strings |
| Body schemas (`@Body`) | `z.number()` | JSON body deserialization handles type conversion |
| Path parameter schemas (`@Param`) | `z.string()` | Path params are always strings — coerce only if you need a number |

**Common AI mistake:** using `z.number()` for a query param — this fails validation because `"20"` does not satisfy `z.number()`. Always use `z.coerce.number()` for numeric query parameters.

---

## Re-exporting Domain Constants

The contracts package re-exports domain constants so consumers import from `@old-st/contracts/{domain}` (subpath):

```typescript
// In schemas.ts
export { {ENTITY}_STATUSES, {Entity}StatusEnum } from '@old-st/{domain}-domain';
```

This means application services and controllers import from `@old-st/contracts/{domain}` — never from the bare `@old-st/contracts` root or directly from `@old-st/{domain}-domain`. See the `contracts-subpath-imports` skill for the full domain isolation rule.

---

## DTO Mapping in Application Service

Contracts schemas validate API output via `schema.parse()` in the application service:

```typescript
private toDto(entity: {Entity}): {Entity}Response {
  return {entity}ResponseSchema.parse({
    {entity}Id:    entity.get{Entity}Id(),
    field1:        entity.getField1(),
    field2:        entity.getField2(),
    {entity}Status: entity.get{Entity}Status(),
    dateCreated:   entity.getDateCreated(),
    updatedAt:     entity.getUpdatedAt(),
  });
}
```

If `toDto()` throws a Zod error, it means a field returned by the entity does not match the contract schema — fix the schema or the getter, not the error handler.

---

## Barrel + Path Alias Updates (Required)

`packages/contracts/{domain}/src/index.ts`:
```typescript
export * from './schemas';
// export * from './event-schemas';  ← add when event schemas exist
```

`tsconfig.base.json` — add path alias (if not already present):
```json
{
  "paths": {
    "@old-st/contracts/{domain}": ["packages/contracts/{domain}/src/index.ts"]
  }
}
```

**Service imports must use the domain-scoped path:**
```typescript
import { create{Entity}Schema } from '@old-st/contracts/{domain}';
import { PaginatedResponse } from '@old-st/contracts/common';
```
