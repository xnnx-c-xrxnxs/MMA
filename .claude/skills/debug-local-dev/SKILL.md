---
name: debug-local-dev
description: Diagnose and fix common local development failures. Use this when a service fails to start, a DynamoDB/Postgres/SQS operation errors, a Prisma engine binary is missing, or tests fail with infrastructure errors in the local environment.
---

# Debug Local Development Issues

This skill is a structured diagnostic runbook covering the most common local development failure modes in this workspace.

---

## Quick Diagnosis Checklist

Before diving into specific failures, run through these in order:

```powershell
# 1. Verify Node.js version (must be 24)
node --version

# 2. Check Docker/LocalStack is running
docker ps --filter "name=localstack"

# 3. Check all services have their env vars
cat .env.local | grep -E "PORT|STAGE|DYNAMODB|DATABASE|SQS"

# 4. Check currently running services (ports)
netstat -an | findstr "LISTENING" | findstr ":300"
```

---

## Failure 1 — Service Fails to Start: `STAGE is not defined` or Wrong Mode

**Symptom:** Service boots in the wrong mode (tries to hit real AWS instead of LocalStack), or throws on startup because `STAGE` is undefined.

**Cause:** `.env.local` is missing or not being loaded.

**Fix:**

```powershell
# Check the file exists
Test-Path .env.local

# Verify STAGE is set
Get-Content .env.local | Select-String "STAGE"
# Expected: STAGE=local
```

1. If missing, copy `.env.local.example` → `.env.local` and fill in values.
2. Verify the NestJS service `main.ts` loads `.env.local` before bootstrapping:
   ```typescript
   import * as dotenv from 'dotenv';
   dotenv.config({ path: '.env.local' });
   ```
3. All local/AWS branching in code **must** check `process.env.STAGE === 'local'` — never `process.env.NODE_ENV === 'development'`.

---

## Failure 2 — LocalStack: Table/Queue Not Found

**Symptom:** `ResourceNotFoundException: Requested resource not found` from DynamoDB, or `QueueDoesNotExist` from SQS.

**Cause:** LocalStack started after tables/queues were supposed to be created, or setup script was not run.

**Fix:**

```powershell
# Step 1: Confirm LocalStack is running
docker compose ps

# Step 2: Re-run the setup script (non-destructive)
pnpm run localstack:setup

# Step 3: If tables still missing, force recreate
pnpm run localstack:setup:force

# Step 4: Verify tables exist
aws dynamodb list-tables --endpoint-url http://localhost:4566 --region eu-west-2

# Step 5: Verify SQS queues exist
aws sqs list-queues --endpoint-url http://localhost:4566 --region eu-west-2
```

**If a new domain was recently added** and tables are still missing:
- Check `scripts/setup-localstack.ts` — the new table's `TableConfig` must be registered there.
- Check `scripts/setup-localstack.ts` — the new queue's `QUEUE_CONFIGS` entry must be registered.
- Run `pnpm run localstack:setup:force` after updating the script.

**DynamoDB GSI mismatch** — If a table exists but queries return wrong results or a GSI index is not found:
```powershell
# Delete the table and recreate it (force wipes all local data)
pnpm run localstack:setup:force
```
GSI definitions cannot be updated in-place on DynamoDB — you must drop and recreate.

---

## Failure 3 — Prisma: Engine Binary Not Found

**Symptom:**
```
Error: unable to locate libquery_engine-windows.dll.node
Error: Unable to require(`./libquery_engine-rhel-openssl-3.0.x.so.node`)
```

**Cause A — Local dev:** Prisma client not generated, or generated for wrong OS.

```powershell
# Regenerate the Prisma client
cd packages/{domain}-domain
npx prisma generate

# Then restart the service
```

**Cause B — Webpack build:** Engine binary not copied to `dist/`.

Check the service's `webpack.config.js`. It must include:
```typescript
assets: [
  {
    from: 'node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node',
    to: 'libquery_engine-rhel-openssl-3.0.x.so.node',
  },
  {
    from: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
    to: 'schema.prisma',
  },
],
```

**Cause C — CI/CD runner:** `prisma generate` was not run before webpack build.

In CI workflows, ensure there is a `pnpm prisma:{domain}:generate` step immediately after `Install dependencies`. Without it, webpack cannot find the engine binary on a fresh runner.

---

## Failure 4 — Postgres: Connection Refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432` or `Can't reach database server`.

**Cause:** The Postgres Docker container is not running, or the `DATABASE_URL` points to the wrong port/database.

**Fix:**

```powershell
# Step 1: Check if the postgres container is running
docker compose ps | Select-String "postgres"

# Step 2: Start it
docker compose up -d postgres  # or the specific service name in docker-compose.yml

# Step 3: Check the DATABASE_URL in .env.local
Get-Content .env.local | Select-String "DATABASE_URL"
# Expected: ORDERS_DATABASE_URL=postgresql://dev:dev@localhost:5432/orders_db

# Step 4: Run migrations if the database exists but schema is missing
cd packages/{domain}-domain
npx prisma migrate dev
```

**If the Postgres container fails to start:**
```powershell
docker compose logs postgres
```
Common causes: port 5432 already in use by another Postgres installation, or insufficient Docker memory.

---

## Failure 5 — SQS Queue URL in Wrong Format

**Symptom:** `The address https://sqs.eu-west-2.amazonaws.com/...` is unreachable, or SQS operations hang.

**Cause:** The `{DOMAIN}_SQS_QUEUE_URL` in `.env.local` uses the production AWS format instead of the LocalStack format.

**Correct local format:**
```
http://sqs.{DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/{queue-name}
```

**Wrong format (do not use locally):**
```
https://sqs.eu-west-2.amazonaws.com/123456789012/queue-name
```

**Fix:** Update `.env.local`:
```
DEFAULT_REGION=eu-west-2
USER_EVENTS_SQS_QUEUE_URL=http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/user-events
```

The `000000000000` is LocalStack's fake account ID. The region segment must match `DEFAULT_REGION`.

---

## Failure 6 — Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Fix:**

```powershell
# Find who is using the port
netstat -ano | findstr ":3000"

# Kill the process (replace PID)
Stop-Process -Id {PID} -Force

# Or kill all Node processes (nuclear option)
Get-Process node | Stop-Process -Force
```

Each service uses its own port env var (`USER_SERVICE_PORT=3000`, `PRODUCT_SERVICE_PORT=3001`, etc.). Check `.env.local` matches the port registry in the instructions.

---

## Failure 7 — Node Version Mismatch

**Symptom:** Build errors referencing unsupported syntax, or `pnpm` fails with unexpected errors.

**Fix:**

```powershell
# Check current version
node --version  # Must be v24.x.x

# Switch using nvm
nvm use  # Uses .nvmrc (pinned to 24)

# If nvm is not installed
winget install CoreyButler.NVMforWindows
nvm install 24
nvm use 24
```

---

## Failure 8 — `pnpm install` Fails or Modules Missing

**Symptom:** `Cannot find module '@mma/{domain}-domain'` or similar after adding a new package.

**Fix:**

```powershell
# Step 1: Install workspace dependencies
pnpm install

# Step 2: If a new package was added, verify tsconfig.base.json has the path alias
Get-Content tsconfig.base.json | Select-String "@mma/{new-package}"

# Step 3: Verify the package.json name matches the path alias
Get-Content packages/{new-package}/package.json | Select-String '"name"'
```

If path alias is missing from `tsconfig.base.json`, add it by following the `nx-microservice-scaffold` or `link-workspace-packages` skill.

---

## Failure 9 — E2E Tests Hit Wrong Infrastructure

**Symptom:** E2E tests pass but dirty dev data or fail because they find existing records from development.

**Cause:** E2E tests are pointed at development tables/databases instead of dedicated E2E infrastructure.

**Fix:**

```powershell
# Confirm E2E env vars are set (not dev vars)
Get-Content .env.e2e | Select-String "TABLE_NAME\|DATABASE_URL"
# Should see: OldSTTable_E2E_Users, orders_e2e_db, etc.

# Setup E2E infrastructure if not yet created
pnpm run e2e:setup
```

E2E infrastructure is defined in `scripts/setup-e2e.ts`. Dev and E2E must never share tables or databases.

---

## Failure 10 — Structural Lint Check Fails in CI

**Symptom:** CI fails in the "coding standards" step with violations like `[service-registry-env-sync]` or `[event-handler-service-exists]`.

**Run locally to reproduce:**

```powershell
npx ts-node --project scripts/tsconfig.json scripts/lint-standards.ts
```

**Common causes and fixes:**

| Error prefix | Common cause | Fix |
|---|---|---|
| `service-registry-sync` | New API service not registered | Add entry to `.github/service-registry.json` → `apiServices[]` |
| `service-registry-env-sync` | New env var missing from registry or env file | Add to `envVars[]` in registry JSON and to `service-registry.env` |
| `event-handler-service-exists` | API service publishes events but no event-handler service exists | Create `{domain}-event-handler-service` or check if the publisher import is a false positive |
| `domain-exception-filter-exists` | API service missing `DomainExceptionFilter` | Create `src/presentation/filters/domain-exception.filter.ts` (see `domain-exception-filter` skill) |
| `barrel-export-completeness` | New folder missing `index.ts` | Add barrel `export * from './...'` to each new `src/` subfolder |
| `no-toObject-in-entities` | Entity has `toObject()` method | Remove it — serialization is the application service's responsibility |

---

## Last Resort: Full Local Reset

If nothing else works — wipes all LocalStack data and Prisma state:

```powershell
# Stop everything
docker compose down -v

# Clean Nx cache
pnpm nx reset

# Reinstall
pnpm install

# Start fresh
docker compose up -d

# Recreate all tables and queues
pnpm run localstack:setup:force

# Re-run Prisma migrations
pnpm run db:migrate:all
```
