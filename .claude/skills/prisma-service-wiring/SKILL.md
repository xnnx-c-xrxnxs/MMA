---
name: prisma-service-wiring
description: Wire PrismaClient into a NestJS module for a Prisma-based domain. Use this when replacing DynamoDB table wiring with Prisma, or when scaffolding a new service that uses Prisma + PostgreSQL. Covers PrismaConfig singleton, provider token pattern, module wiring, and env var requirements.
---

# Wiring Prisma in a NestJS Module

---

## Overview

Prisma-based services use `PrismaConfig` (singleton client factory) instead of `DynamoDBConfig`. The wiring pattern replaces `DYNAMO_TABLE` + `DynamoDBConfig.getTable()` with `PRISMA_CLIENT` + `PrismaConfig.getClient()`.

---

## Step 1: Create PrismaConfig

File: `apps/{domain}/{service}/src/infrastructure/config/prisma.config.ts`

```typescript
import path from 'path';
import { PrismaClient } from '@old-st/{domain}-domain/infrastructure';

/**
 * Provides a singleton PrismaClient for this service.
 *
 * Secret resolution ({DOMAIN}_DATABASE_URL ARN → postgresql:// URL) is handled
 * by SecretsConfig.resolve() at Lambda cold-start — PrismaConfig assumes the
 * env var is already a valid connection string when getClient() is called.
 */
export class PrismaConfig {
  private static client: PrismaClient;

  static async getClient(): Promise<PrismaClient> {
    if (!this.client) {
      if (process.env.STAGE !== 'local') {
        // When bundled by webpack for Lambda, __dirname is /var/task.
        // Prisma's internal dirname (baked at generate-time) does not match,
        // so we must point it to the copied engine file explicitly.
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
          __dirname,
          'libquery_engine-rhel-openssl-3.0.x.so.node',
        );
      }

      this.client = new PrismaClient();
    }
    return this.client;
  }
}
```

**Rules:**
- Import `PrismaClient` from the domain's infrastructure barrel (`@old-st/{domain}-domain/infrastructure`), not from `@prisma/client`.
- `getClient()` is **async** — NestJS `useFactory` handles `Promise`-returning factories transparently.
- The singleton pattern ensures one connection pool per process.
- When deployed (`STAGE !== 'local'`), `PRISMA_QUERY_ENGINE_LIBRARY` is set to the absolute path of the Linux engine binary copied to `/var/task` by webpack. No ARN resolution happens here.
- **ARN resolution is handled by `SecretsConfig.resolve()`** (from `@old-st/aws-secrets`) which must be called at the very start of the Lambda `handler` export in `main.ts`, before NestJS bootstrap. Pass only the env var keys this service needs — e.g. `await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])`. This populates only those keys from the project-level `AWS_SECRETS_ARN` secret, keeping each service isolated from secrets it doesn't own.
- Locally (`STAGE=local`) the env var is a plain `postgresql://` URL from `.env.local` — `SecretsConfig.resolve()` is a no-op.

---

## Step 2: Module Wiring

File: `apps/{domain}/{service}/src/modules/{domain}.module.ts`

### Provider Tokens

```typescript
const PRISMA_CLIENT = 'PRISMA_CLIENT';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';
```

### Module Structure

```typescript
import { Module } from '@nestjs/common';
import {
  I{Entity}Repository,
  // ... use cases
} from '@old-st/{domain}-domain';
import { Prisma{Entity}Repository, PrismaClient } from '@old-st/{domain}-domain/infrastructure';
import { PrismaConfig } from '../infrastructure/config/prisma.config';
import { {Entity}ApplicationService } from '../application/services/{entity}-application.service';
import { {Entity}Controller } from '../presentation/controllers/{entity}.controller';

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

@Module({
  controllers: [{Entity}Controller],
  providers: [
    // ── Prisma client (singleton) ──
    {
      provide: PRISMA_CLIENT,
      useFactory: () => PrismaConfig.getClient(),
    },
    // ── Repository ──
    {
      provide: {ENTITY}_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new Prisma{Entity}Repository(prisma),
      inject: [PRISMA_CLIENT],
    },
    // ── Use cases ──
    {
      provide: SomeUseCase,
      useFactory: (repo: I{Entity}Repository) => new SomeUseCase(repo),
      inject: [{ENTITY}_REPOSITORY],
    },
    // ... additional use cases follow the same pattern
    // ── Application service ──
    {Entity}ApplicationService,
  ],
  exports: [{Entity}ApplicationService],
})
export class {Entity}Module {}
```

---

## Comparison: DynamoDB vs Prisma Wiring

### DynamoDB Pattern (user-domain, product-domain)

```typescript
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { Dynamo{Entity}Repository, {Entity}Schema } from '@old-st/{domain}-domain/infrastructure';
import { Table } from 'dynamodb-onetable';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

// ...
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
```

### Prisma Pattern (order-domain)

```typescript
import { PrismaConfig } from '../infrastructure/config/prisma.config';
import { Prisma{Entity}Repository, PrismaClient } from '@old-st/{domain}-domain/infrastructure';

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const {ENTITY}_REPOSITORY = '{ENTITY}_REPOSITORY';

// ...
{
  provide: PRISMA_CLIENT,
  useFactory: () => PrismaConfig.getClient(), // async — NestJS awaits the Promise
},
{
  provide: {ENTITY}_REPOSITORY,
  useFactory: (prisma: PrismaClient) => new Prisma{Entity}Repository(prisma),
  inject: [PRISMA_CLIENT],
},
```

**Key differences:**
- No schema import needed (Prisma reads schema at build time).
- No table name env var in the module (Prisma reads `DATABASE_URL` from its schema datasource block).
- Import source changes from `dynamodb-onetable` types to domain's generated `PrismaClient`.
- Token changes from `DYNAMO_TABLE` to `PRISMA_CLIENT`.

---

## Step 3: Event Handler Service Wiring

Event handler services (SQS consumers) follow the same pattern but with no `controllers` array:

```typescript
@Module({
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
    // ... use cases
    SqsLocalService,
    {Entity}EventHandlerService,
  ],
  exports: [{Entity}EventHandlerService],
})
export class {Entity}Module {}
```

Create the same `PrismaConfig` in the event handler's infrastructure:
`apps/{domain}/{service}-event-handler-service/src/infrastructure/config/prisma.config.ts`

---

## Step 4: Environment Variables

Add to `.env.local`:
```
{DOMAIN}_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}_db
```

Add to `.env.local.example`:
```
{DOMAIN}_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}_db
```

**Rules:**
- Prisma-based services do NOT need `{DOMAIN}_DYNAMODB_TABLE_NAME` or `DYNAMODB_ENDPOINT`.
- The database URL is the only required env var for local development.
- For deployed environments, Terraform injects `AWS_SECRETS_ARN` into the Lambda. `SecretsConfig.resolve()` reads this secret at cold-start and populates `{DOMAIN}_DATABASE_URL` (and all other sensitive vars). PrismaConfig no longer needs to detect or resolve ARNs.

---

## Step 5: Register Domain in the Migration Script

### Local development

The workspace uses a centralized migration script at `scripts/prisma-migrate-all.ts` that loads `.env.local` and runs `prisma migrate deploy` for every registered Prisma domain. This script is triggered by the `DB: Migrate All` VS Code task, which runs as part of `Dev: Start All`.

Open `scripts/prisma-migrate-all.ts` and add an entry to the `PRISMA_DOMAINS` array:

```typescript
const PRISMA_DOMAINS: PrismaDomain[] = [
  // ... existing domains
  {
    name: '{domain}-domain',
    schemaPath: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
    envVar: '{DOMAIN}_DATABASE_URL',
  },
];
```

### Deployed environments (RDS in private VPC)

RDS is in private VPC subnets — the CI runner has no network path to it. Running `prisma migrate deploy` from GitHub Actions is not possible.

Migrations are applied via the **ECS init-runner** — a one-shot Fargate container defined in `infra/init-runner/` that runs registered deploy tasks from within the VPC:
1. The `deployTasks` array in `service-registry.json` declares a `prisma-migrate` entry with `secretEnvVars: ["{DOMAIN}_DATABASE_URL"]`.
2. The CD workflow builds the init-runner Docker image (which has `prisma` pre-installed) and runs it as an ECS Fargate task.
3. The init-runner `entrypoint.mjs` resolves secrets from `AWS_SECRETS_ARN` (populating only declared keys), then runs `npx prisma migrate deploy --schema=/app/prisma/{domain}/schema.prisma`.
4. The CD workflow waits for the ECS task to stop and checks the exit code before deploying Lambda code.

When `deployTasks` is empty in `service-registry.json`, zero ECS resources are created and the CD workflow skips the init-runner job entirely — zero cost.

> ⚠️ Never attempt to run migrations from the CI runner directly against a VPC-private RDS instance. There is no network path from GitHub Actions to private subnets.

### How the local task chain works

```
Dev: Start All (sequence)
  → Infra: Start + Setup (sequence)
      → LocalStack: Start + Setup (sequence)
          → Docker: Start LocalStack
          → LocalStack: Create Tables
      → DB: Migrate All
          → runs pnpm run prisma:migrate:all (loads .env.local automatically)
  → Services: Start All (parallel)
      → all service tasks
```

The `DB: Migrate All` task runs `pnpm run prisma:migrate:all`, which:
1. Loads `.env.local` so `{DOMAIN}_DATABASE_URL` is available.
2. Iterates over `PRISMA_DOMAINS` and calls `prisma migrate deploy` for each.
3. Exits non-zero if any migration fails.

**No additional task registration is needed per domain.** Adding the entry to `PRISMA_DOMAINS` is sufficient.

---

## Migration Checklist (DynamoDB → Prisma)

When converting an existing DynamoDB-based service to Prisma:

- [ ] Create `infrastructure/config/prisma.config.ts` in the service
- [ ] Replace `DYNAMO_TABLE` token with `PRISMA_CLIENT` in module
- [ ] Replace `DynamoDBConfig.getTable(...)` with `PrismaConfig.getClient()`
- [ ] Replace `Dynamo{Entity}Repository` with `Prisma{Entity}Repository` in providers
- [ ] Replace `Table` type injection with `PrismaClient` type
- [ ] Update imports: remove `dynamodb-onetable`, `@old-st/dynamodb-onetable`, `{Entity}Schema`
- [ ] Add `PrismaClient` import from `@old-st/{domain}-domain/infrastructure`
- [ ] Remove `HttpModule` import if it was only needed for DynamoDB (keep if used for ACL clients)
- [ ] Replace `{DOMAIN}_DYNAMODB_TABLE_NAME` env var with `{DOMAIN}_DATABASE_URL`
- [ ] Remove DynamoDB table config from `scripts/setup-localstack.ts`
- [ ] Add `"DB: Migrate {Domain}"` task to `.vscode/tasks.json`
- [ ] Remove `dynamodb-onetable` and `@old-st/dynamodb-onetable` from domain package.json
- [ ] Register domain in `scripts/prisma-migrate-all.ts` → `PRISMA_DOMAINS` array
- [ ] Add `cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/` to the `Package init-runner` step in `.github/workflows/cd-deploy.yml` and `cd-preview-create.yml` — without this, deployed migrations will fail because the Lambda won't have the Prisma schema
- [ ] Add a `prisma-migrate` entry to `deployTasks[]` in `service-registry.json` — this tells the CD pipeline to run migrations via the Lambda init-runner
- [ ] Add `ignoreWarnings` + Prisma engine binary + `schema.prisma` to webpack `assets` array (see `nx-microservice-scaffold` skill for the template)
- [ ] Import `SecretsConfig` from `@old-st/aws-secrets` in the service's `main.ts` Lambda handler and call `await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` before NestJS bootstrap
