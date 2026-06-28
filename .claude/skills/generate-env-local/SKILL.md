---
name: generate-env-local
description: Generate or update .env.local (and .env.local.example) by scanning the codebase for all environment variable references. Use this when onboarding a new developer, after adding a new service, or when .env.local is missing or stale. Reads main.ts, module files, SQS service files, and scripts/setup-localstack.ts to discover every required variable automatically.
---

# Generating `.env.local` from the Codebase

> **This skill produces two outputs:** `.env.local` (gitignored, for the current developer) and `.env.local.example` (committed, the shared template). Always update both.

---

## Required Information — Ask Before Starting

1. **Does `.env.local` already exist?**
   - **Yes, add missing keys only** — scan codebase, identify variables not present in the existing file, append them at the end of each relevant section.
   - **Yes, overwrite completely** — regenerate the full file from scratch using codebase scan results.
   - **No (fresh clone)** — generate the full file from scratch.

2. **What is the `DEFAULT_REGION` value?**
   - This controls both the SQS client region and the LocalStack SQS queue URL format.
   - Default: `eu-west-2` (current workspace default — confirm before using).

---

## Step 1 — Scan `scripts/setup-localstack.ts` (Table + Queue inventory)

This is the **single authoritative source** for DynamoDB table names and SQS queue names. Read the full file:

```
scripts/setup-localstack.ts
```

Extract from `TABLE_CONFIGS`:
- Every `envVar` field → the `{DOMAIN}_DYNAMODB_TABLE_NAME` env var name
- Every `defaultName` field → the default table name value

Extract from `QUEUE_CONFIGS`:
- Every `nameEnvVar` field → the `{DOMAIN}_SQS_QUEUE_NAME` env var name
- Every `defaultName` field → the default queue name value
- Whether `fifo: true` (default) or `fifo: false` (explicit Standard opt-out) — FIFO queues get a `.fifo` suffix on the name and URL

This step gives you the **complete list of DynamoDB tables and SQS queues** — do not rely on grep alone.

> **Prisma-based domains** (e.g. order-domain) do not appear in `TABLE_CONFIGS`. Their database URLs are discovered in Step 1b instead.

---

## Step 1b — Scan Prisma schema files (PostgreSQL database URLs)

Some domains use Prisma + PostgreSQL instead of DynamoDB. For each domain package that has a Prisma schema:

```
packages/{domain}-domain/src/infrastructure/prisma/schema.prisma
```

Extract from the `datasource db` block:
- The `env()` call in the `url` field → the `{DOMAIN}_DATABASE_URL` env var name (e.g. `ORDERS_DATABASE_URL`)

Also check the domain's `prisma.config.ts` (in the service app):

```
apps/{domain}/{service}/src/infrastructure/config/prisma.config.ts
```

Extract:
- `process.env.{DOMAIN}_DATABASE_URL` references → confirms the var name

This step gives you the **complete list of PostgreSQL connection strings** needed by Prisma-based domains.

> **DynamoDB-based domains** (e.g. user-domain, product-domain) do not have Prisma schemas. Skip this step for them.

---

## Step 2 — Scan all `main.ts` files (Service ports)

For each HTTP API service, read its `main.ts`:

```
apps/{domain}/{service}/src/main.ts
```

Extract:
- `process.env.{DOMAIN}_SERVICE_PORT` references → the port env var name
- The numeric default (e.g. `|| 3000`) → the fallback port value

> **Event-driven (SQS consumer) services have no HTTP server.** If `main.ts` contains no `app.listen()` call, skip port registration for that service.

---

## Step 3 — Scan all module files (DynamoDB table / Prisma client + SQS queue URL refs)

For each service, read its module:

```
apps/{domain}/{service}/src/modules/{domain}.module.ts
```

Extract:
- `process.env.{DOMAIN}_DYNAMODB_TABLE_NAME` references → confirm the var name matches Step 1 (DynamoDB domains)
- `process.env.{DOMAIN}_DATABASE_URL` references → confirm the var name matches Step 1b (Prisma domains)
- `process.env.{DOMAIN}_SQS_QUEUE_URL` references → the SQS publisher queue URL var

> **Prisma-based modules** reference `DATABASE_URL` via `PrismaConfig` instead of `DynamoDBConfig`. Check both patterns.

---

## Step 4 — Scan all SQS service files (SQS consumer queue URL refs)

For each event-driven service, read:

```
apps/{domain}/{service}/src/infrastructure/sqs/sqs-local.service.ts
```

Extract:
- `process.env.{DOMAIN}_SQS_QUEUE_URL` references → the queue URL var consumed by this service
- `process.env.DEFAULT_REGION` references → confirms DEFAULT_REGION is required
- `process.env.LOCALSTACK_ENDPOINT` references → confirms LOCALSTACK_ENDPOINT is required

---

## Step 5 — Derive SQS queue URLs

For each queue discovered in Step 1, derive the LocalStack URL using this pattern:

```
http://sqs.{DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/{queueName}
```

Rules:
- `{DEFAULT_REGION}` is the value confirmed in Required Information question 2.
- `{queueName}` is the `defaultName` from `QUEUE_CONFIGS` in `setup-localstack.ts`.
- For FIFO queues (`fifo: true` — the default): append `.fifo` to the queue name in the URL. Standard queues (`fifo: false` — explicit opt-out) omit the suffix.
- The LocalStack fake account ID is always `000000000000`.

---

## Step 6 — Build the env file content

Assemble the file in this exact section order. Never change the ordering.

```dotenv
# =============================================================================
# .env.local.example — committed template for local development
# =============================================================================
# This file is SAFE TO COMMIT. It contains no real secrets.
# All local values are identical for every developer.
#
# FIRST-TIME SETUP:
#   cp .env.local.example .env.local
#
# .env.local is gitignored — NEVER commit it.
# =============================================================================

# ─── Runtime mode ─────────────────────────────────────────────────────────────
STAGE=local
NODE_ENV=production

# ─── LocalStack / Docker ──────────────────────────────────────────────────────
DEFAULT_REGION={DEFAULT_REGION}
LOCALSTACK_ENDPOINT=http://localhost:4566

# ─── DynamoDB ──────────────────────────────────────────────────────────────────
DYNAMODB_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# ─── DynamoDB table names (per-domain — DynamoDB domains only) ────────────────
{DOMAIN}_DYNAMODB_TABLE_NAME={defaultTableName}
# ... one line per table discovered in Step 1

# ─── PostgreSQL database URLs (per-domain — Prisma domains only) ──────────────
{DOMAIN}_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}_db
# ... one line per Prisma domain discovered in Step 1b

# ─── Service ports (HTTP API services only) ───────────────────────────────────
{DOMAIN}_SERVICE_PORT={port}
# ... one line per HTTP API service discovered in Step 2

# ─── API base URLs (consumed by frontend apps) ────────────────────────────────
API_{DOMAIN}_URL=http://localhost:{port}/api
# ... one line per HTTP API service

# ─── Frontend base URL (CORS, OAuth redirects) — one entry shared by all ──────
FE_BASE_URL=http://localhost:4200

# ─── SQS queues ───────────────────────────────────────────────────────────────
{DOMAIN}_SQS_QUEUE_NAME={defaultQueueName}
{DOMAIN}_SQS_QUEUE_URL=http://sqs.{DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/{defaultQueueName}
# ... one NAME + URL pair per queue discovered in Step 1
```

> **For `.env.local`:** identical content. Remove the header comments block if the developer prefers a minimal file; keep all variable lines.

---

## Step 7 — Write the files

1. Write (or patch) `.env.local` at the workspace root.
2. Write (or patch) `.env.local.example` at the workspace root.

**If mode is "add missing keys only":**
- Read the existing file.
- For each variable in the generated content that is **not already present**, append it to the correct section (or add the section if missing).
- Never remove or reorder existing lines.

**If mode is "overwrite" or "fresh clone":**
- Write the full file from scratch.

---

## Step 8 — Verify

After writing, confirm:

- [ ] Every HTTP API service has a `{DOMAIN}_SERVICE_PORT` and `API_{DOMAIN}_URL` entry
- [ ] Every SQS consumer service has a `{DOMAIN}_SQS_QUEUE_URL` entry
- [ ] Every SQS publisher module's `process.env.{DOMAIN}_SQS_QUEUE_URL` is covered
- [ ] Every table in `scripts/setup-localstack.ts` `TABLE_CONFIGS` has a `{DOMAIN}_DYNAMODB_TABLE_NAME` entry
- [ ] Every Prisma domain discovered in Step 1b has a `{DOMAIN}_DATABASE_URL` entry
- [ ] Every queue in `scripts/setup-localstack.ts` `QUEUE_CONFIGS` has a `{DOMAIN}_SQS_QUEUE_NAME` and `{DOMAIN}_SQS_QUEUE_URL` entry
- [ ] `DEFAULT_REGION` in the SQS queue URLs matches the `DEFAULT_REGION` variable value
- [ ] `.env.local.example` has been updated alongside `.env.local`

---

## Checklist for Keeping `.env.local.example` in Sync

After any of these tasks, re-run this skill (add-missing-keys mode) to keep `.env.local.example` current:

| Task completed | Variables likely added |
|---|---|
| `nx-microservice-scaffold` (HTTP API service, DynamoDB) | `{DOMAIN}_SERVICE_PORT`, `API_{DOMAIN}_URL`, `{DOMAIN}_DYNAMODB_TABLE_NAME` |
| `nx-microservice-scaffold` (HTTP API service, Prisma) | `{DOMAIN}_SERVICE_PORT`, `API_{DOMAIN}_URL`, `{DOMAIN}_DATABASE_URL` |
| `prisma-service-wiring` | `{DOMAIN}_DATABASE_URL` |
| `sqs-event-driven-service` | `{DOMAIN}_SQS_QUEUE_URL`, `{DOMAIN}_SQS_QUEUE_NAME` |
| `sqs-event-publisher` | `{DOMAIN}_SQS_QUEUE_URL`, `{DOMAIN}_SQS_QUEUE_NAME` (if new queue) |
| New table added to `scripts/setup-localstack.ts` | `{DOMAIN}_DYNAMODB_TABLE_NAME` |
| New Prisma domain added (`schema.prisma` with `datasource db`) | `{DOMAIN}_DATABASE_URL` |
| New queue added to `scripts/setup-localstack.ts` | `{DOMAIN}_SQS_QUEUE_NAME`, `{DOMAIN}_SQS_QUEUE_URL` |
