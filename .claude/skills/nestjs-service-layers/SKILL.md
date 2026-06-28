---
name: nestjs-service-layers
description: Scaffold the complete internal NestJS layer structure for a microservice. Use this when creating or extending apps/{domain}/{service}/src/ with application services, infrastructure config, domain module wiring, presentation controllers, pipes, and filters. Follows the user-api-service pattern exactly.
---

# Scaffolding NestJS Service Layers

> **This skill is for HTTP API services only.** For SQS event-driven consumer services (no HTTP, no Swagger) use the `sqs-event-driven-service` skill instead.

This skill covers the **internal NestJS layer architecture** of a service. For Nx project registration (project.json, tsconfig, webpack) use the `nx-microservice-scaffold` skill first.

---

## Layer Overview

```
src/
  main.ts                                   ← dual-mode bootstrap: local Express + AWS Lambda handler
  app/
    app.module.ts                           ← root NestJS module
    app.controller.ts                       ← health/root endpoint
    app.service.ts
  application/
    services/
      {entity}-application.service.ts      ← orchestrates use cases, transforms to DTOs
  infrastructure/
    config/
      dynamodb.config.ts                   ← DynamoDB client + table singleton (DynamoDB domains)
      prisma.config.ts                     ← PrismaClient singleton (Prisma domains)
    clients/
      {upstream-domain}-api.client.ts      ← ACL adapter for cross-service HTTP calls (optional)
  modules/
    {domain}.module.ts                     ← wires all providers
  presentation/
    index.ts                               ← barrel (exports DomainExceptionFilter)
    controllers/
      {entity}.controller.ts              ← HTTP routes
    pipes/
      zod-validation.pipe.ts              ← Zod validation
    filters/
      domain-exception.filter.ts          ← maps domain errors to HTTP status codes
```

> **`infrastructure/clients/`** is only needed when the service makes synchronous HTTP calls to another bounded context (e.g. Order API → User API). Follow the `sync-cross-service-call` skill for the full pattern. Services that don't call other services do not need this folder.

---

## 0. Local Environment (`.env.local`)

Every service requires a `.env.local` file at the **workspace root** for local development. This file is gitignored — never commit it.

```dotenv
# ── Runtime mode ──────────────────────────────────────────────────────────────
# STAGE=local activates:
#   - local Express bootstrap in main.ts (bootstrapServer())
#   - local DynamoDB client in DynamoDBConfig (createDynamoLocalClient())
#   - Swagger addServer() is skipped (no AWS base-path prefix needed)
STAGE=local
NODE_ENV=production

# ── Docker / LocalStack ───────────────────────────────────────────────────────────
# Start: docker compose up -d   Stop: docker compose down   Wipe: docker compose down -v
LOCALSTACK_ENDPOINT=http://localhost:4566

# ── DynamoDB ──────────────────────────────────────────────────────────────────
# Consumed by DynamoDBConfig.getClient() when STAGE=local. Points at LocalStack.
DYNAMODB_ENDPOINT=http://localhost:4566

# Fake credentials required by the AWS SDK when targeting LocalStack.
# LocalStack accepts any non-empty value — remove before deploying to AWS.
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Per-domain DynamoDB table names — one env var per domain service.
# Replace {DOMAIN} with the plural resource name (e.g. USERS, PRODUCTS, ORDERS).
# All can point to the same physical table (single-table design) or to
# separate tables — the env var makes this a deployment-time decision.
{DOMAIN}_DYNAMODB_TABLE_NAME=OldSTTable

# ── AWS (only needed when STAGE != local) ─────────────────────────────────────
# AWS_REGION=us-east-1
# SERVER_NAME={service-name}

# ── Service ports ─────────────────────────────────────────────────────────────
# Each service reads its OWN named env var — all can run simultaneously.
# Port registry (claim the next available port when adding a new service):
#   3000 → user-api-service    (USER_SERVICE_PORT)
#   3001 → product-api-service (PRODUCT_SERVICE_PORT)
# Replace {DOMAIN}_SERVICE_PORT with the actual var (e.g. USER_SERVICE_PORT).
{DOMAIN}_SERVICE_PORT={PORT}

# ── API Endpoint URLs (consumed by frontend applications) ─────────────────────
# Pattern: API_{DOMAIN}_URL=http://localhost:${DOMAIN}_SERVICE_PORT/api
# Add one entry per API service. Frontend apps read these instead of hardcoding URLs.
#   API_USER_URL=http://localhost:3000/api
#   API_PRODUCT_URL=http://localhost:3001/api
API_{DOMAIN}_URL=http://localhost:{PORT}/api

# Base URL of the frontend application (shared — one entry, not per service).
# Used for CORS config, OAuth redirects, cross-service references.
FE_BASE_URL=http://localhost:4200
```

**Rules:**
- `STAGE=local` is the **single source of truth** for "is this a local run?". It controls both `main.ts` bootstrap selection and `DynamoDBConfig` client selection. Do not use `NODE_ENV` for this purpose.
- `NODE_ENV=production` is correct locally — it reflects the production build mode used by webpack/NestJS. It does **not** control local vs AWS routing.
- `DYNAMODB_ENDPOINT` must be set to `http://localhost:4566` (the LocalStack Gateway). When set, it also triggers `createDynamoLocalClient()` as a fallback.
- `LOCALSTACK_ENDPOINT` is the same `http://localhost:4566` value, consumed by `createLocalStackClient()` and any other AWS SDK clients added in future.
- `AWS_ACCESS_KEY_ID=test` and `AWS_SECRET_ACCESS_KEY=test` must be in `.env.local` so the AWS SDK resolves credentials against LocalStack. Unset them before deploying to AWS — real credentials come from IAM roles.
- `.env.local` must be added to `.gitignore`. Do not create `.env` without the `.local` suffix.
- When scaffolding a new service, check if `.env.local` already exists at the workspace root and **add the appropriate persistence env var** (`{DOMAIN}_DYNAMODB_TABLE_NAME` for DynamoDB domains, `{DOMAIN}_DATABASE_URL` for Prisma domains), plus `{DOMAIN}_SERVICE_PORT` and `API_{DOMAIN}_URL` for the new service — do not replace the file.
- `FE_BASE_URL` is a single shared entry — add it once, do not duplicate per service.
- The `{DOMAIN}_DYNAMODB_TABLE_NAME` pattern (e.g. `USERS_DYNAMODB_TABLE_NAME`, `PRODUCTS_DYNAMODB_TABLE_NAME`) makes table ownership explicit and allows each service to point to a different table in AWS without code changes.

---

## 1. `src/main.ts`

All API services use a **single bootstrap function** that starts a plain NestJS HTTP server. **AWS Lambda Web Adapter** proxies Lambda invocation events to the HTTP server — no `@codegenie/serverless-express` or dual-mode handler export needed. Replace `{SERVICE-NAME}` with the actual service name (e.g. `USER-API-SERVICE`).

```typescript
import { initTelemetry } from '@mma/telemetry';
import { correlationMiddleware } from '@mma/telemetry';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { DomainExceptionFilter } from './presentation';
// Prisma services only — remove next line for DynamoDB services:
import { SecretsConfig } from '@mma/aws-secrets';

function createSwaggerConfig() {
  const builder = new DocumentBuilder()
    .setTitle(`{SERVICE-NAME} [${process.env.STAGE}]`)
    .setDescription('{SERVICE-NAME} API')
    .setVersion('1.0');

  builder.addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  );

  // In deployed environments the API Gateway routes traffic to this Lambda
  // under /{DOMAIN_PREFIX}, and Lambda Web Adapter strips that prefix before
  // forwarding to NestJS. NestJS itself never sees the prefix — but the
  // Swagger UI in the browser does. Without addServer(), the "Try it out"
  // button calls /api/... directly and misses the gateway prefix → 404.
  // DOMAIN_PREFIX is injected by Terraform for every Lambda; it is unset
  // locally so this is a no-op for local development.
  if (process.env.DOMAIN_PREFIX) {
    builder.addServer(`/${process.env.DOMAIN_PREFIX}`);
  }

  return builder.build();
}

function setupGlobalMiddleware(app: INestApplication) {
  app.use(correlationMiddleware()); // MUST be first — generates/propagates correlationId
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
}

async function bootstrap() {
  const isLocal = process.env.STAGE === 'local';

  // Prisma services only — remove this block for DynamoDB services:
  if (!isLocal) {
    await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL']);
  }

  initTelemetry('{service-name}');

  const app = await NestFactory.create(AppModule);

  setupGlobalMiddleware(app);

  // Swagger is gated per environment. Always on locally; opt-in elsewhere via
  // SWAGGER_ENABLED=true. Enabled by default in dev/staging/preview by
  // Terraform; opt-in only in prod. The route paths /api/swagger,
  // /api/swagger-json AND /api/swagger/{proxy+} must be added to
  // gatewayAuth.publicRoutes in service-registry.json — the {proxy+} entry
  // is required so the Swagger UI static bundle (JS/CSS/icons) can load
  // through the gateway without 401. See the gateway-jwt-auth skill.
  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    const config = createSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });
  }

  const port = process.env.{DOMAIN}_SERVICE_PORT || process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`🚀 {SERVICE-NAME} is running on: http://localhost:${port}/api`);
}

bootstrap();
```

**Rules:**
- **Single `bootstrap()` function** — no dual-mode, no `cachedServer`, no `handler` export.
- Lambda Web Adapter handles Lambda↔HTTP translation via its layer — the app just starts an HTTP server.
- `STAGE=local` is used only for environment-specific guards (e.g. SecretsConfig, telemetry), not for branching into different bootstrap paths.
- The default port is `8080` (Lambda Web Adapter default). Locally, `{DOMAIN}_SERVICE_PORT` overrides it.
- `setupGlobalMiddleware()` centralises all global configuration.
- `DomainExceptionFilter` is registered inside `setupGlobalMiddleware` via `useGlobalFilters`.
- `HttpLoggingInterceptor` is registered via `useGlobalInterceptors` — logs every request as `METHOD /path → status in Xms` with `actorId` (when authenticated), `correlationId`, `traceId`, `durationMs`. Place the file at `src/presentation/interceptors/http-logging.interceptor.ts` — it is a per-service copy (same convention as `JwtAuthGuard`). The service name in `createLogger()` must match the service name passed to `initTelemetry()`.
- Swagger title includes `[${process.env.STAGE}]` to identify the environment.
- No `DOMAIN_PREFIX` is needed for **request routing** — Lambda Web Adapter's `AWS_LWA_REMOVE_BASE_PATH` strips the domain prefix before the request reaches NestJS. However, the Swagger `DocumentBuilder` MUST call `.addServer(`/${process.env.DOMAIN_PREFIX}`)` so the in-browser Swagger UI knows to send "Try it out" requests **with** the prefix (otherwise it hits the gateway at the wrong path and gets 404). Terraform injects `DOMAIN_PREFIX` into every Lambda; it is unset locally so the call is a no-op for local development.
- JWT-protected controllers use `@ApiBearerAuth('JWT-auth')` — the security name must match the second argument of `addBearerAuth()`.
- Replace `{SERVICE-NAME}` with the actual screaming-snake-case service name (e.g. `USER-API-SERVICE`).
- Replace `{DOMAIN}` with the domain's uppercase name (e.g. `USER`, `ORDER`).
- Replace `{service-name}` with the kebab-case service name (e.g. `user-api-service`).
- Replace `{DOMAIN}_SERVICE_PORT` with the actual env var name (e.g. `USER_SERVICE_PORT`) and `{PORT}` with the port number claimed from the registry in `CLAUDE.md §7.1`. Each service must have its own dedicated port — never use the generic `PORT` var in a domain service.

---

## 2. `src/app/app.controller.ts` — Health Endpoint

Every HTTP API service **must** have a health endpoint at `GET /api/health`. This is used by the CD smoke test after deployment and by load balancers.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../presentation/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: '{service-name}' };
  }
}
```

**Rules:**
- Always use `@Get('health')` — never `@Get()` (root). The smoke test hits `{base-url}/health`.
- Always mark with `@Public()` — health checks must bypass JWT auth.
- Replace `{service-name}` with the kebab-case service name (e.g. `user-api-service`).
- The method name is always `health()` — not `getHealth()`, not `ping()`.
- The route resolves to `GET /api/health` (global prefix `api` + route `health`).

---

## 3. `src/app/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { {Domain}Module } from '../modules/{domain}.module';
import { AppController } from './app.controller';

@Module({
  imports: [{Domain}Module],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

> **JWT Guard is provider-agnostic.** The guard reads `JWT_JWKS_URI`, `JWT_ISSUER`, and `JWT_USER_ID_CLAIM` from env vars. This makes it compatible with Cognito, Auth0, or Keycloak without code changes. Locally (`STAGE=local`), the guard bypasses JWKS verification. See the `auth-api-service` skill for the full guard pattern.

---

## 4. `src/infrastructure/config/` — Persistence Config

### DynamoDB domains (user-domain, product-domain)

`dynamodb.config.ts`:

```typescript
import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';
import { createDynamoLocalClient, createAWSClient, createTable } from '@mma/dynamodb-onetable';

export class DynamoDBConfig {
  private static client: Dynamo;
  private static tables = new Map<string, Table>();

  static getClient(): Dynamo {
    const isLocal =
      process.env.STAGE === 'local' || !!process.env.DYNAMODB_ENDPOINT;
    this.client = isLocal
      ? createDynamoLocalClient()
      : createAWSClient(process.env.AWS_REGION || 'us-east-1');
    return this.client;
  }

  static getTable(name: string, schema: object): Table {
    if (!this.tables.has(name)) {
      this.tables.set(name, createTable({ client: this.getClient(), name, schema }));
    }
    const table = this.tables.get(name);
    if (!table) {
      throw new Error(`Failed to initialise DynamoDB table: ${name}`);
    }
    return table;
  }
}
```

### Prisma domains (order-domain)

`prisma.config.ts`:

```typescript
import { PrismaClient } from '@mma/{domain}-domain/infrastructure';

export class PrismaConfig {
  private static client: PrismaClient;

  static getClient(): PrismaClient {
    if (!this.client) {
      this.client = new PrismaClient();
    }
    return this.client;
  }
}
```

**Rules:**
- Import `PrismaClient` from the domain's infrastructure barrel (`@mma/{domain}-domain/infrastructure`), not from `@prisma/client`.
- No `STAGE === 'local'` check needed — Prisma reads `DATABASE_URL` from the env automatically.
- See the `prisma-service-wiring` skill for the full wiring pattern.

---

## 5. `src/modules/{domain}.module.ts` — Full Provider Chain

This is the most critical file. Follow this exact pattern. Every use case gets its own `useFactory` provider.

### DynamoDB domains (user-domain, product-domain)

```typescript
import { Module } from '@nestjs/common';
import {
  I{Entity}Repository,
  Create{Entity}UseCase,
  GetEntityByIdUseCase,
  // ... all use cases
} from '@mma/{domain}-domain';
import { Dynamo{Entity}Repository, {Entity}Schema } from '@mma/{domain}-domain/infrastructure';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { {Entity}ApplicationService } from '../application/services/{entity}-application.service';
import { {Entity}Controller } from '../presentation/controllers/{entity}.controller';

const DYNAMO_TABLE      = 'DYNAMO_TABLE';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  controllers: [{Entity}Controller],
  providers: [
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.{DOMAIN}_DYNAMODB_TABLE_NAME || 'OldSTTable',
          {Entity}Schema,
        ),
    },
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (table: Table) => new Dynamo{Entity}Repository(table),
      inject: [DYNAMO_TABLE],
    },
    {
      provide: Create{Entity}UseCase,
      useFactory: (repo: I{Entity}Repository) => new Create{Entity}UseCase(repo),
      inject: [{ENTITY}_REPOSITORY],
    },
    // ... repeat for every use case
    {Entity}ApplicationService,
  ],
  exports: [{Entity}ApplicationService],
})
export class {Domain}Module {}
```

### Prisma domains (order-domain)

```typescript
import { Module } from '@nestjs/common';
import {
  I{Entity}Repository,
  Create{Entity}UseCase,
  GetEntityByIdUseCase,
  // ... all use cases
} from '@mma/{domain}-domain';
import { Prisma{Entity}Repository, PrismaClient } from '@mma/{domain}-domain/infrastructure';
import { PrismaConfig } from '../infrastructure/config/prisma.config';
import { {Entity}ApplicationService } from '../application/services/{entity}-application.service';
import { {Entity}Controller } from '../presentation/controllers/{entity}.controller';

const PRISMA_CLIENT     = 'PRISMA_CLIENT';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  controllers: [{Entity}Controller],
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => PrismaConfig.getClient(),
    },
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new Prisma{Entity}Repository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: Create{Entity}UseCase,
      useFactory: (repo: I{Entity}Repository) => new Create{Entity}UseCase(repo),
      inject: [{ENTITY}_REPOSITORY],
    },
    // ... repeat for every use case
    {Entity}ApplicationService,
  ],
  exports: [{Entity}ApplicationService],
})
export class {Domain}Module {}
```

See the `prisma-service-wiring` skill for the complete wiring guide.

**Rules:**
- `DYNAMO_TABLE` and `{ENTITY}_REPOSITORY` are local string constants — not enums, not symbols.
- Every use case gets its **own** `useFactory` provider that injects the repository token.
- `{Entity}ApplicationService` is provided as a plain class — no factory needed.
- Export **only** `{Entity}ApplicationService` — never export use cases, repositories, or the table.

---

## 6. `src/application/services/{entity}-application.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import {
  {entity}ResponseSchema,
  Create{Entity}Input,
  {Entity}Response,
  List{Entities}ByStatusInput,
} from '@mma/contracts/{domain}';
import {
  {Entity},
  Create{Entity}UseCase,
  GetEntityByIdUseCase,
  // ... all use cases
} from '@mma/{domain}-domain';

@Injectable()
export class {Entity}ApplicationService {
  constructor(
    private readonly create{Entity}UseCase: Create{Entity}UseCase,
    private readonly get{Entity}ByIdUseCase: Get{Entity}ByIdUseCase,
    // ... inject all use cases
  ) {}

  private toDto(entity: {Entity}): {Entity}Response {
    return {entity}ResponseSchema.parse({
      {entity}Id:    entity.get{Entity}Id(),
      field1:        entity.getField1(),
      // ... all fields
    });
  }

  // ... one method per use case
}
```

> **ACL target endpoints need logs too.** If another service calls a read endpoint via an ACL adapter (e.g. Order API validates a customer by calling `GET /users/:userId`), the application method handling that call must have before/after `logger.info()` — even though it's a read-only method. Without these logs, the upstream service won't appear in the monitoring event chain. See the `sync-cross-service-call` skill for full details.
```

### Pagination: DynamoDB domains (cursor-based)

```typescript
import { IPaginatedResponse } from '@mma/common';
import { PaginatedResponse } from '@mma/contracts/common';

private toPaginatedDto(result: IPaginatedResponse<{Entity}>): PaginatedResponse<{Entity}Response> {
  return {
    data: result.data.map((e) => this.toDto(e)),
    nextCursorPointer: result.nextCursorPointer,
    prevCursorPointer: result.prevCursorPointer,
  };
}

async listByStatus(status: string, limit?: number, direction?: string, cursor?: string) {
  const result = await this.listByStatusUseCase.execute({
    status,
    limit,
    direction,
    nextCursorPointer: direction === 'next' ? cursor : undefined,
    prevCursorPointer: direction === 'prev' ? cursor : undefined,
  });
  return this.toPaginatedDto(result);
}
```

### Pagination: Prisma domains (offset-based)

```typescript
import { IOffsetPaginatedResponse } from '@mma/common';
import { OffsetPaginatedResponse } from '@mma/contracts/common';

private toPaginatedDto(result: IOffsetPaginatedResponse<{Entity}>): OffsetPaginatedResponse<{Entity}Response> {
  return {
    data: result.data.map((e) => this.toDto(e)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

async listByStatus(status: string, page?: number, limit?: number) {
  const result = await this.listByStatusUseCase.execute({ status, page, limit });
  return this.toPaginatedDto(result);
}
```

**Rules:**
- Import input/output types from `@mma/contracts/{domain}` — never from the bare `@mma/contracts` root or from `@mma/{domain}-domain`.
- Import shared types (`PaginatedResponse`) from `@mma/contracts/common`.
- `toDto()` uses `{entity}ResponseSchema.parse()` — Zod validates the output shape.
- Domain entities **never** cross the application service boundary — only DTOs are returned.
- Pagination: cursor routing (`direction === 'next' ? cursor : undefined`) happens here, not in the use case.

### Aggregate DTO Mapping Pattern

When the domain entity is an aggregate root with child entities, break the DTO mapping into separate private methods for each child type. This keeps `toDto()` readable and matches the aggregate structure.

```typescript
@Injectable()
export class {Root}ApplicationService {
  // ... use case injections

  private toItemDto(item: {Child}): /* inline object type */ {
    return {
      itemId: item.getItemId(),
      productId: item.getProductId(),
      quantity: item.getQuantity(),
      price: item.getPrice(),
    };
  }

  private toPaymentDto(payment: {Payment} | null): /* inline object type | null */ {
    if (!payment) return null;
    return {
      paymentId: payment.getPaymentId(),
      method: payment.getMethod(),
      status: payment.getStatus(),
      amount: payment.getAmount(),
    };
  }

  private toDto(root: {Root}): {Root}Response {
    return {root}ResponseSchema.parse({
      {root}Id: root.get{Root}Id(),
      items: root.getItems().map((item) => this.toItemDto(item)),
      payment: this.toPaymentDto(root.getPayment()),
      status: root.getStatus(),
      totalAmount: root.getTotalAmount(),
      dateCreated: root.getDateCreated(),
      updatedAt: root.getUpdatedAt(),
    });
  }
}
```

**Rules:**
- One `to{Child}Dto()` method per child entity type.
- `toDto()` on the root calls child mappers — never inlines the mapping.
- All child DTO methods are `private` — they're internal to the application service.
- The Zod `parse()` at the root level validates the entire nested structure in one pass.

---

## 7. `src/presentation/pipes/zod-validation.pipe.ts`

```typescript
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
```

---

## 8. `src/presentation/filters/domain-exception.filter.ts`

See the `domain-exception-filter` skill for the full implementation.

---

## 9. `src/presentation/controllers/{entity}.controller.ts`

See the `add-api-endpoints` skill for route design rules.  
See the `swagger-controller-docs` skill for **mandatory** Swagger annotation rules.

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { {Entity}ApplicationService } from '../../application/services/{entity}-application.service';
import {
  create{Entity}Schema,
  update{Entity}Schema,
  Create{Entity}Input,
  Update{Entity}Input,
} from '@mma/contracts/{domain}';

// ── Shared response schema consts ──────────────────────────────────────────────
const {entity}ResponseSchema = {
  type: 'object' as const,    // ← 'as const' is REQUIRED
  properties: {
    {entity}Id: { type: 'string', example: '{prefix}_01HX4ABCDE' },
    // ... all fields from the entity response contract
  },
  required: ['{entity}Id', /* all non-optional fields */],
};

@ApiTags('{entities}')    // plural noun, must match the route prefix
@Controller('{entities}')
export class {Entity}Controller {
  constructor(private readonly {entity}ApplicationService: {Entity}ApplicationService) {}

  // Static paths MUST come before dynamic /:id paths

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new {entity}' })
  @ApiBody({
    description: '{Entity} creation payload',
    schema: {
      type: 'object' as const,
      properties: {
        // ... fields from create{Entity}Schema
      },
      required: [/* non-optional fields */],
    },
  })
  @ApiCreatedResponse({ description: '{Entity} created', schema: {entity}ResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: '{Entity} already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  create{Entity}(@Body(new ZodValidationPipe(create{Entity}Schema)) body: Create{Entity}Input) {
    return this.{entity}ApplicationService.create{Entity}(body);
  }

  @Get(':{entity}Id')
  @ApiOperation({ summary: 'Get {entity} by ID' })
  @ApiParam({ name: '{entity}Id', description: '{Entity} UUID', example: '{prefix}_01HX4ABCDE' })
  @ApiOkResponse({ description: '{Entity} found', schema: {entity}ResponseSchema })
  @ApiNotFoundResponse({ description: '{Entity} not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  get{Entity}ById(@Param('{entity}Id') id: string) {
    return this.{entity}ApplicationService.get{Entity}ById(id);
  }

  // ...
}
```

---

## 10. `src/presentation/index.ts`

```typescript
export { DomainExceptionFilter } from './filters/domain-exception.filter';
export { ZodValidationPipe } from './pipes/zod-validation.pipe';
```

This barrel is imported in `main.ts` to access `DomainExceptionFilter`.

---

## 11. `src/presentation/decorators/current-user.decorator.ts` + `src/presentation/types/express.d.ts`

Every API service MUST ship the `@CurrentUser()` decorator and the `Express.Request` type augmentation so controllers can read the authenticated actor (Golden Rule #45). These two files are **identical across services** — paste the canonical versions below verbatim.

```typescript
// presentation/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  userRole?: string;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'CurrentUser decorator used on a route without an authenticated user. ' +
          'Ensure JwtAuthGuard is wired as APP_GUARD and the route is not @Public().',
      );
    }
    return field ? user[field] : user;
  },
);
```

```typescript
// presentation/types/express.d.ts
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
```

Controllers then read the actor like this — never from `@Body()`, `@Query()`, or `@Param()`:

```typescript
@Post()
async createOrder(
  @CurrentUser() user: AuthenticatedUser,
  @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
) {
  return this.orderService.create({ ...body, customerId: user.userId });
}
```

See the `current-user-decorator` skill for full usage patterns (single-field extraction, admin actions on other users, testing).

---

## Checklist

- [ ] `.env.local` at workspace root exists and contains `STAGE=local`, `NODE_ENV=production`, `DYNAMODB_ENDPOINT`, `{DOMAIN}_DYNAMODB_TABLE_NAME`, and `PORT` for this service (add missing vars if the file already exists — do not overwrite)
- [ ] `.env.local` is present in `.gitignore`
- [ ] `main.ts` has `createSwaggerConfig()` with `addBearerAuth('JWT-auth')`
- [ ] `main.ts` has `setupGlobalMiddleware()` registering `correlationMiddleware()` (FIRST), `DomainExceptionFilter`, `ValidationPipe`, `enableCors`, `setGlobalPrefix('api')`
- [ ] `main.ts` has `bootstrapServer()` guarded by `STAGE === 'local'`
- [ ] `main.ts` has `bootstrapLambda()` with `cachedServer` guard and `ExpressAdapter`
- [ ] `main.ts` exports `handler` with `/{domain}` prefix stripping and swagger path fix (`/swagger` → `/swagger/`, `swagger-ui` prefix)
- [ ] **Prisma services only:** `main.ts` `handler` calls `await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` before NestJS boots; imports `SecretsConfig` from `@mma/aws-secrets`
- [ ] **Prisma services only:** Migrations are handled by the ECS init-runner — `main.ts` does **not** contain any migration code (`execSync`, `prisma migrate deploy`, `event.migrate`)
- [ ] **Prisma services only:** `webpack.config.js` assets copy `libquery_engine-rhel-openssl-3.0.x.so.node` and `schema.prisma` to dist root
- [ ] `AppModule` imports `{Domain}Module`
- [ ] `dynamodb.config.ts` `isLocal` check uses `STAGE === 'local' || !!DYNAMODB_ENDPOINT` — never `NODE_ENV`
- [ ] `{domain}.module.ts` has every use case as a `useFactory` provider
- [ ] `{entity}-application.service.ts` is `@Injectable()` and transforms entities to DTOs
- [ ] `zod-validation.pipe.ts` is present
- [ ] `domain-exception.filter.ts` is present with all domain errors mapped
- [ ] Controller uses static routes before dynamic `/:id` routes
- [ ] Controller has `@ApiTags('{entities}')` on the class
- [ ] Every route method has `@ApiOperation({ summary })`, a success response decorator, and `@ApiInternalServerErrorResponse`
- [ ] Every `@Body()` param has `@ApiBody` with `type: 'object' as const` schema and `required: [...]` array
- [ ] Every `@Query()` enum param (status, role) has `@ApiQuery` with `required: true` and `enum: [...]`
- [ ] Every `@Query()` pagination param has `@ApiQuery` with `required: false`
- [ ] Every `@Param()` path segment has `@ApiParam`
- [ ] Shared `{entity}ResponseSchema` and `paginated{Entities}ResponseSchema` consts defined near top of file with `type: 'object' as const`
- [ ] `presentation/index.ts` barrel exports `DomainExceptionFilter`
- [ ] `presentation/decorators/current-user.decorator.ts` exists (copy from any existing service) — required by Golden Rule #45
- [ ] `presentation/types/express.d.ts` exists and augments `Express.Request` with `AuthenticatedUser`
- [ ] `main.ts` Swagger setup is wrapped in `if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') { ... }`
- [ ] Public routes (`@Public()` decorated endpoints, e.g. `GET /api/health`, `GET /api/docs`) are also listed in `service-registry.json` → `gatewayAuth.publicRoutes` (see `gateway-jwt-auth` skill)
- [ ] `{SERVICE-NAME}` placeholder replaced with the real screaming-snake-case service name
