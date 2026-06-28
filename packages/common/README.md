# @old-st/common

Common interfaces and types shared across domain and infrastructure layers.

## Purpose

This package provides type-only interfaces and utilities that are used internally by:
- Domain layers
- Repository implementations  
- Infrastructure utilities

## Key Principles

1. **Type-Only**: No runtime validation or dependencies
2. **Lightweight**: Minimal overhead for internal operations
3. **Shared**: Reusable across all domains without coupling

## Distinction from @old-st/contracts

| Package | Purpose | Usage | Validation |
|---------|---------|-------|------------|
| `@old-st/common` | Internal interfaces | Repositories, Infrastructure | None (TypeScript only) |
| `@old-st/contracts` | API DTOs | Controllers, API responses | Zod runtime validation |

## Usage Example

### Repository Layer (Uses @old-st/common)
```typescript
// packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.ts
import { IPaginatedResponse } from '@old-st/common';
import { {Entity} } from '../../domain/entities/{entity}.entity';

export class Dynamo{Entity}Repository implements I{Entity}Repository {
  async findAll(limit: number): Promise<IPaginatedResponse<{Entity}>> {
    const records = await this.table.query(...);
    
    // Use common interface - no validation overhead
    return {
      data: records.map(r => {Entity}.reconstitute(r)),
      nextCursorPointer: records.length === limit ? { pk: last.pk } : null,
      prevCursorPointer: null,
    };
  }
}
```

### Application Service Layer (Transforms to @old-st/contracts)
```typescript
// apps/{domain}/{domain}-api-service/application/services/{entity}.service.ts
import { IPaginatedResponse } from '@old-st/common';
import { paginatedResponseSchema, {entity}ResponseSchema } from '@old-st/contracts/{domain}';
import { {Entity} } from '@old-st/{domain}-domain';

export class {Entity}ApplicationService {
  async getEntities(limit: number) {
    // Get result with common interface (no validation)
    const result: IPaginatedResponse<{Entity}> = await this.repository.findAll(limit);
    
    // Transform domain entities to DTOs
    const dtoData = result.data.map(entity => ({
      // ...map getters to plain DTO fields
    }));
    
    // Validate and return using contracts schema
    return paginatedResponseSchema({entity}ResponseSchema).parse({
      data: dtoData,
      nextCursorPointer: result.nextCursorPointer,
      prevCursorPointer: result.prevCursorPointer,
    });
  }
}
```

### Controller Layer (Uses @old-st/contracts)
```typescript
// apps/{domain}/{domain}-api-service/presentation/controllers/{entity}.controller.ts
import { paginatedResponseSchema, {entity}ResponseSchema } from '@old-st/contracts/{domain}';

export class {Entity}Controller {
  async getEntities(req: Request) {
    const result = await this.{entity}Service.getEntities(10);
    
    // Result is already validated by application service
    // OpenAPI docs automatically generated from Zod schema
    return result; // Type: PaginatedResponse<{Entity}ResponseDto>
  }
}
```

> **Reference implementation:** see [examples/packages/user-domain/](examples/packages/user-domain/) and [examples/apps/users/user-api-service/](examples/apps/users/user-api-service/) for working code.

## What Belongs Here

✅ **Include:**
- Common interfaces (pagination, result types)
- Shared type definitions
- Type-only utility types
- Generic helpers without dependencies

❌ **Exclude:**
- API validation schemas (use @old-st/contracts)
- Domain-specific logic (use domain packages)
- Infrastructure implementations (use specific packages)
- Runtime validation (use Zod in contracts)
