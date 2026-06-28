---
name: cd-register-service
description: Register a new service or infrastructure resource in the CD pipeline. Use this when adding a new API service, event-handler service, DynamoDB table, SQS queue, RDS PostgreSQL database, or S3 bucket to the Terraform deployment. Covers service-registry.json updates and verification.
---

# CD Registration — Adding Services and Infrastructure to Terraform

Canonical references:
- `.github/service-registry.json` — Single source of truth for CI and CD
- `infra/environments/dev/main.tf` — Canonical environment root (shows how Terraform reads the registry)

All Terraform environment roots create AWS resources by iterating over `service-registry.json` with `for_each`. Adding a new service or infrastructure resource means updating this JSON file — not editing `.tf` files.

---

## Required Information — Ask Before Starting

1. **What are you adding?** — API service, event-handler service, DynamoDB table, SQS queue, RDS PostgreSQL database, or S3 bucket?
2. **Domain name** — e.g., `user`, `product`, `order`, `shipping`
3. **For services:** Nx project name, distPath, memory size, timeout, env vars needed
4. **For services:** Does it need VPC access (e.g., RDS/Prisma)? → `requiresVpc: true`
5. **For event-handler services:** Which SQS queue does it consume from? → `sqsQueueRef`
6. **For DynamoDB tables:** Which GSIs are needed? (index name, hash key, sort key, types)
7. **For SQS queues:** FIFO (default) or Standard (explicit opt-out for high-throughput fan-out)?
8. **For RDS databases:** Database name?
9. **Does this domain introduce new `NEXT_PUBLIC_*` env vars?** If so, update webapp too.

---

## Step-by-Step: Add an API Service

### 1. Add to `apiServices[]` in `service-registry.json`

```json
{
  "name": "{domain}-api-service",
  "distPath": "dist/apps/{domain}/{domain}-api-service/main.js",
  "domain": "{domain}",
  "type": "api",
  "handler": "run.sh",
  "memorySize": 512,
  "timeout": 30,
  "envVars": [
    "{DOMAIN}_DYNAMODB_TABLE_NAME",
    "FE_BASE_URL"
  ]
}
```

**Field reference:**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Nx project name (matches `project.json` → `name`) |
| `distPath` | Yes | Path to compiled `main.js` from workspace root |
| `domain` | Yes | Domain name (lowercase, singular) |
| `type` | Yes | Always `"api"` for HTTP API services |
| `handler` | Yes | Lambda handler entry point — `"run.sh"` for API services (Lambda Web Adapter), `"main.handler"` for event handlers |
| `memorySize` | Yes | Lambda memory in MB (default: `512`) |
| `timeout` | Yes | Lambda timeout in seconds (default: `30`) |
| `requiresVpc` | No | Set `true` if the service accesses RDS (Prisma domains) |
| `envVars` | Yes | Array of env var names the Lambda function needs at runtime |

**Common `envVars` patterns:**
- DynamoDB domain: `["{DOMAIN}_DYNAMODB_TABLE_NAME", "{DOMAIN}_SQS_QUEUE_URL", "FE_BASE_URL"]`
- Prisma domain: `["{DOMAIN}_DATABASE_URL", "{DOMAIN}_SQS_QUEUE_URL", "FE_BASE_URL"]` + set `requiresVpc: true`
- Cross-service calls: Add `"API_{UPSTREAM_DOMAIN}_URL"` for each upstream service called via ACL

### 2. Add to `service-registry.env`

Add a section for the new domain's env vars that CI E2E needs:

```bash
# {Domain} Service
{DOMAIN}_SERVICE_PORT={PORT}
API_{DOMAIN}_URL=http://localhost:{PORT}/api
NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{PORT}/api
{DOMAIN}_DYNAMODB_TABLE_NAME=OldSTTable
```

---

## Step-by-Step: Add an Event-Handler Service

### 1. Add to `eventHandlerServices[]` in `service-registry.json`

```json
{
  "name": "{domain}-event-handler-service",
  "distPath": "dist/apps/{domain}/{domain}-event-handler-service/main.js",
  "domain": "{domain}",
  "type": "worker",
  "handler": "main.handler",
  "memorySize": 256,
  "timeout": 60,
  "sqsQueueRef": "{DOMAIN}_SQS_QUEUE_NAME",
  "envVars": ["{DOMAIN}_DYNAMODB_TABLE_NAME"]
}
```

**Additional field for workers:**

| Field | Required | Description |
|---|---|---|
| `sqsQueueRef` | Yes | The `envVar` of the SQS queue this worker consumes from (must match an entry in `infrastructure.sqsQueues`) |

**If the worker publishes events to another queue** (cross-domain), add the target queue URL to `envVars`:
```json
"envVars": ["{DOMAIN}_DYNAMODB_TABLE_NAME", "{OTHER_DOMAIN}_SQS_QUEUE_URL"]
```

---

## Step-by-Step: Add Infrastructure Resources

### DynamoDB Table

Add to `infrastructure.dynamodbTables[]`:

```json
{
  "envVar": "{DOMAIN}_DYNAMODB_TABLE_NAME",
  "domain": "{domain}",
  "gsis": [
    { "indexName": "GSI1", "hashKey": "GSI1PK", "hashKeyType": "S", "sortKey": "GSI1SK", "sortKeyType": "S" }
  ]
}
```

The `envVar` is used by Terraform to:
1. Name the table: `{project_name}-{environment}-{envVar}`
2. Inject the table name into Lambda environment variables via `resolved_vars`

GSI entries must match the OneTable schema exactly. Each GSI object:
- `indexName` — GSI name (e.g., `GSI1`, `GSI2`)
- `hashKey` — Partition key attribute name
- `hashKeyType` — `"S"` (string) or `"N"` (number)
- `sortKey` — Sort key attribute name (optional — omit for partition-only GSIs)
- `sortKeyType` — Sort key type (required if `sortKey` is present)

### SQS Queue

Add to `infrastructure.sqsQueues[]`:

```json
{
  "envVar": "{DOMAIN}_SQS_QUEUE_NAME",
  "domain": "{domain}",
  "fifo": true,
  "description": "{domain}-event-handler inbox"
}
```

**Rules:**
- `envVar` must end with `_SQS_QUEUE_NAME`
- **`fifo: true` is the default** — Terraform auto-appends `.fifo` to the queue name and DLQ name
- Set `fifo: false` only for explicit Standard opt-out (high-throughput fan-out, no ordering requirement)
- Terraform creates both the main queue and a DLQ (dead-letter queue) for each entry

### RDS PostgreSQL Database

Add to `infrastructure.rds[]`:

```json
{
  "envVar": "{DOMAIN}_DATABASE_URL",
  "domain": "{domain}",
  "dbName": "{domain}_db"
}
```

**Rules:**
- `envVar` is the key name stored **inside** the project-level Secrets Manager secret (not a Lambda env var). Terraform reads it to build the secret's JSON: `{ "{DOMAIN}_DATABASE_URL": "postgresql://..." }`.
- `dbName` must be a valid PostgreSQL database name (lowercase, underscores).
- Terraform creates a project-level secret (`{project_name}-{environment}-secrets`) containing all sensitive vars. Lambda functions receive `AWS_SECRETS_ARN` pointing to this secret. `SecretsConfig.resolve()` at Lambda cold-start reads it and sets all keys as `process.env`.
- Services accessing RDS must set `requiresVpc: true` in their service entry and `"AWS_SECRETS_ARN"` in their `envVars` array (not `{DOMAIN}_DATABASE_URL`).
- `@aws-sdk/client-secrets-manager` must be in the workspace root `package.json` (already present).

#### Deployed Migration Strategy

RDS is inside a **private VPC** — the CI runner has no network path to it. `prisma migrate deploy` cannot be run directly from GitHub Actions.

Migrations are applied via the **ECS init-runner** — a one-shot Fargate container defined in `infra/init-runner/`:
1. The `deployTasks` array in `service-registry.json` declares a `prisma-migrate` entry with `secretEnvVars: ["{DOMAIN}_DATABASE_URL"]` and `envVars: ["AWS_SECRETS_ARN"]`.
2. The CD workflow builds the init-runner Docker image (which has `prisma` pre-installed) and runs it as an ECS Fargate task within the VPC.
3. The init-runner resolves secrets from `AWS_SECRETS_ARN`, then runs `npx prisma migrate deploy --schema=/app/prisma/{domain}/schema.prisma`.
4. The CD workflow waits for the task to complete and checks the exit code before deploying Lambda code.

When `deployTasks` is empty, zero ECS resources are created and the CD workflow skips the init-runner job entirely — zero cost.

**Adding a new Prisma domain's migration task:**
```json
{
  "name": "{domain}-migrations",
  "type": "prisma-migrate",
  "domain": "{domain}",
  "requiresVpc": true,
  "secretEnvVars": ["{DOMAIN}_DATABASE_URL"],
  "envVars": ["AWS_SECRETS_ARN"]
}
```

Also add a `cp -r` line to the `Package init-runner` step in `.github/workflows/cd-deploy.yml` and `.github/workflows/cd-preview-create.yml`:
```bash
cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/
```

### S3 Bucket

Add to `infrastructure.s3Buckets[]`:

```json
{
  "envVar": "{DOMAIN}_S3_BUCKET_NAME",
  "domain": "{domain}"
}
```

---

## Step-by-Step: Add a New `NEXT_PUBLIC_*` Env Var

When a new domain is added, the webapp usually needs a new `NEXT_PUBLIC_API_{DOMAIN}_URL` env var.

### 1. Add to `webapp.envVars` in `service-registry.json`

```json
"webapp": {
  "envVars": [
    "NEXT_PUBLIC_API_USER_URL",
    "NEXT_PUBLIC_API_PRODUCT_URL",
    "NEXT_PUBLIC_API_ORDER_URL",
    "NEXT_PUBLIC_API_{DOMAIN}_URL"
  ]
}
```

In **static mode** (the default), `NEXT_PUBLIC_*` vars are baked at **build time** by `pnpm nx build webapp`. The CD workflow exports these vars as environment variables before running the build — they are sourced from Terraform outputs automatically via the `resolved_vars` local. No Dockerfile changes needed.

If you are using **SSR mode** (`lambda` or `ecs`), you must also add `ARG` + `ENV` lines to `apps/webapp/Dockerfile` in the builder stage:

```dockerfile
ARG NEXT_PUBLIC_API_{DOMAIN}_URL
ENV NEXT_PUBLIC_API_{DOMAIN}_URL=$NEXT_PUBLIC_API_{DOMAIN}_URL
```

---

## Prisma / Lambda Build Requirements

For any **Prisma domain**, the following steps are required in **all CI and CD workflows** (`ci-test-all.yml`, `ci-fast-check.yml`, `ci-test-affected.yml`, `cd-deploy.yml`, `cd-preview-create.yml`) before any `nx build` or `nx test` that touches the Prisma service:

1. **`pnpm prisma:{domain}:generate` before `nx build`/`nx test`** — runs on the Linux runner and produces the `rhel-openssl-3.0.x` engine binary. Without this, webpack cannot locate the binary asset glob and fails with `unable to locate ... libquery_engine-rhel-openssl-3.0.x.so.node`.
2. **`webpack.config.js` asset copy** — the engine binary and `schema.prisma` must be in the `assets` array so webpack copies them to the dist root (`/var/task`).
3. **`binaryTargets` in `schema.prisma`** — must include `["native", "rhel-openssl-3.0.x"]`.
4. **`deployTasks` entry** in `service-registry.json` — add a `prisma-migrate` task for the domain (see "Deployed Migration Strategy" above). Also add a `cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/` line to the `Package init-runner` step in the CD workflows.

All four are already set up for the `order` domain. When adding a new Prisma domain, replicate this pattern and add `pnpm prisma:{domain}:generate` to every CI/CD workflow that builds or tests.

---

## Verification Checklist

After updating `service-registry.json`:

- [ ] JSON is valid (no trailing commas, proper escaping)
- [ ] Every `envVars` entry in services maps to either an `infrastructure.*` entry or a cross-service URL
- [ ] Every `sqsQueueRef` in worker services matches an `envVar` in `infrastructure.sqsQueues`
- [ ] Every `requiresVpc: true` service has a matching `infrastructure.rds` entry (or explicitly needs VPC for another reason)
- [ ] New `NEXT_PUBLIC_*` vars are in `webapp.envVars` (static mode: no Dockerfile needed; SSR mode: also add `ARG`/`ENV` to the Dockerfile)
- [ ] Matching entries added to `service-registry.env` for CI E2E
- [ ] Run `pnpm ts-node --project scripts/tsconfig.json scripts/lint-standards.ts` — the `service-registry-env-sync` check validates that every SQS/DynamoDB/database env var referenced in module code is declared in both `service-registry.json` `envVars[]` and `service-registry.env`

---

## What Terraform Creates Automatically

When you add the JSON entries above, the next `terraform apply` creates:

| Registry entry | AWS resources created |
|---|---|
| `apiServices[]` entry | Lambda function + route on shared API Gateway (`ANY /{domain}/{proxy+}`) + CloudWatch log group + IAM role |
| `eventHandlerServices[]` entry | Lambda function + SQS event source mapping + CloudWatch log group + IAM role |
| `infrastructure.dynamodbTables[]` entry | DynamoDB table (PAY_PER_REQUEST) with all specified GSIs |
| `infrastructure.sqsQueues[]` entry | SQS queue + DLQ pair |
| `infrastructure.rds[]` entry | RDS PostgreSQL instance + Secrets Manager secret |
| `infrastructure.s3Buckets[]` entry | S3 bucket (encrypted, versioned) |

**No `.tf` file edits needed.** The data-driven pattern handles everything via `for_each`.

---

## Important CD Deployment Flags

### `DEPLOY_ENABLED` Sentinel

Push-triggered deployments are **blocked by default** until you explicitly set `DEPLOY_ENABLED=true` as an environment-scoped GitHub variable for each target environment.

- Set in: **GitHub → Settings → Environments → {env} → Variables → `DEPLOY_ENABLED=true`**
- Required per-environment: dev, staging, prod each need their own setting
- Manual dispatch (`workflow_dispatch`) always runs regardless of this flag
- Purpose: prevents accidental deploys when bootstrapping a new environment

### `SENSITIVE_VARS` Secret

Sensitive values (database passwords, API keys) never go into `service-registry.json` or `.tf` files. They are passed through the CI pipeline as a JSON blob:

1. Create `infra/bootstrap/github-secrets` (gitignored): `KEY=value` pairs
2. `AWS: Bootstrap Apply` reads this file and creates the `SENSITIVE_VARS` GitHub secret
3. CD workflows pass `SENSITIVE_VARS` to Terraform, which writes selected keys to Secrets Manager
4. Lambda services call `SecretsConfig.resolve(['KEY_NAME'])` at cold-start to hydrate `process.env`

**RDS database passwords** are auto-generated by Terraform (`random_password` resource) — you do not need to put them in `github-secrets`. Only pre-existing external service credentials go in `github-secrets`.

### Smoke Test

After every deployment, the CD pipeline sends `GET {service-base-url}/health` to every registered API service. A non-200 response causes the deployment to fail. Results are posted to the GitHub Step Summary. This is why every service must have `@Get('health')` + `@Public()` + returning `{ status: 'ok', service: '{service-name}' }`.

