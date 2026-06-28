---
name: init-runner-deploy-task
description: Add a one-shot deploy task that runs during CD deployment — such as a Prisma migration, database seed, DynamoDB seed, or custom script. Use this when a new domain needs migrations applied, initial data seeded, or any other initialization that must run inside the VPC after infrastructure is created but before traffic is routed to new Lambdas.
---

# Add an Init Runner Deploy Task

Canonical references:
- `infra/init-runner/handler.mjs` — Lambda entry point (task dispatcher)
- `infra/init-runner/entrypoint.mjs` — task runner logic (called by handler)
- `infra/init-runner/scripts/` — location for custom `.mjs` scripts
- `.github/service-registry.json → deployTasks[]` — task registration

---

## When to Use This Skill

The init-runner is a one-shot Lambda function that executes during each CD deployment, **after** Terraform creates/updates infrastructure and **before** Lambda functions are swapped to the new version. It runs inside the VPC when needed (e.g. for Prisma migrations against a VPC-private RDS).

**Use it for:**
- Running `prisma migrate deploy` for a Prisma domain (the primary use case)
- Seeding initial reference data (product categories, admin user, Cognito user pool)
- Custom initialization scripts that need AWS SDK access (DynamoDB seed, S3 initialization)

**Do NOT use it for:**
- Logic that should run on every Lambda invocation (use a Lambda handler)
- Long-running background work > 15 min (use an event-driven service)
- Anything that can be done at Terraform `apply` time (use a `null_resource` or `aws_lambda_invocation`)

**Cost awareness:** When `deployTasks` is empty, **zero Lambda resources are created** and the init-runner job is skipped entirely in CD. Tasks only incur cost during deployment runs.

---

## Supported Task Types

| `type` value | What it does | Extra required fields |
|---|---|---|
| `prisma-migrate` | Runs `prisma migrate deploy --schema=/var/task/prisma/{domain}/schema.prisma` | `domain` |
| `custom-script` | Runs `node /var/task/scripts/{script}` | `script` |
| `dynamodb-seed` | Stub — logs and skips (not yet implemented — use `custom-script`) | — |
| `s3-init` | Stub — logs and skips (not yet implemented — use `custom-script`) | — |

---

## Part 1 — Adding a `prisma-migrate` Task

### Step 1 — Add the deployTask entry to `service-registry.json`

Open `.github/service-registry.json` and add to the `deployTasks` array:

```json
{
  "deployTasks": [
    {
      "name": "{domain}-prisma-migrate",
      "type": "prisma-migrate",
      "domain": "{domain}",
      "secretEnvVars": ["{DOMAIN}_DATABASE_URL"],
      "envVars": []
    }
  ]
}
```

**Fields:**

| Field | Purpose |
|---|---|
| `name` | Human-readable identifier. Appears in Lambda CloudWatch logs. Use `{domain}-prisma-migrate`. |
| `type` | Must be `"prisma-migrate"` exactly. |
| `domain` | The Prisma schema directory to migrate. Maps to `/var/task/prisma/{domain}/schema.prisma` inside the Lambda. |
| `secretEnvVars` | List of secret keys to pull from the project-level Secrets Manager secret (`AWS_SECRETS_ARN`). The `DATABASE_URL` must be here — never in plain `envVars`. |
| `envVars` | Plain (non-secret) env vars. Usually empty for Prisma migrations. |

### Step 2 — Add the Prisma schema to the CD workflow ZIP packaging step

In `.github/workflows/cd-deploy.yml`, find the `Package init-runner` step inside the `run-init-tasks` job. Add a `cp` line in the `# ── Copy Prisma schemas` block:

```bash
# ── Copy Prisma schemas (one per domain) ──
# Existing domains:
cp -r packages/{existing-domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{existing-domain}/
# Add this line for your new domain:
cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/
```

This copies `schema.prisma` + the `migrations/` directory into the ZIP so `prisma migrate deploy` can find them at `/var/task/prisma/{domain}/schema.prisma`.

### Step 3 — Ensure `{DOMAIN}_DATABASE_URL` is in the project-level Secret

Terraform creates one Secrets Manager secret per environment (`{project}-{env}-secrets`). The RDS module outputs the connection URL. It must be written into the secret under the key `{DOMAIN}_DATABASE_URL`.

In `infra/environments/{env}/main.tf`, the secret value is assembled from module outputs. Verify your domain's database URL is included:

```hcl
resource "aws_secretsmanager_secret_version" "project" {
  secret_id = aws_secretsmanager_secret.project.id
  secret_string = jsonencode({
    # ... existing entries ...
    {DOMAIN}_DATABASE_URL = module.rds["{domain}"].connection_url
  })
}
```

---

## Part 2 — Adding a `custom-script` Task

Use this for seeding data, configuring Cognito user pools, or any initialization that needs the AWS SDK.

### Step 1 — Create the script in `infra/init-runner/scripts/`

Scripts must be `.mjs` files (ES modules). The Dockerfile copies the entire `scripts/` directory into `/app/scripts/` inside the container.

```javascript
// infra/init-runner/scripts/seed-{domain}.mjs
// Seeds initial {domain} data after deployment.

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.{DOMAIN}_DYNAMODB_TABLE_NAME;

if (!tableName) {
  throw new Error('Missing {DOMAIN}_DYNAMODB_TABLE_NAME');
}

console.log(`[seed-{domain}] Seeding to table: ${tableName}`);

// ... seed logic here ...

console.log('[seed-{domain}] ✓ Seed complete');
```

**Available AWS SDK clients in the Lambda** (pre-installed by the CD workflow's `npm install`):
- `@aws-sdk/client-secrets-manager`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/client-s3`
- `@aws-sdk/client-cognito-identity-provider`

For other SDK clients, add them to the `package.json` written by the `Package init-runner` step in `.github/workflows/cd-deploy.yml`.

### Step 2 — Add the deployTask entry to `service-registry.json`

```json
{
  "deployTasks": [
    {
      "name": "seed-{domain}",
      "type": "custom-script",
      "script": "seed-{domain}.mjs",
      "secretEnvVars": [],
      "envVars": ["{DOMAIN}_DYNAMODB_TABLE_NAME"]
    }
  ]
}
```

**`secretEnvVars` vs `envVars`:**

| Field | When to use | How resolved |
|---|---|---|
| `secretEnvVars` | Sensitive values: database URLs, API keys, passwords | Pulled from Secrets Manager (`AWS_SECRETS_ARN`) at runtime by `handler.mjs` |
| `envVars` | Non-sensitive infra references: table names, queue URLs, S3 bucket names | Injected as plain Lambda environment variables by Terraform |

**Never put database URLs or passwords in `envVars`** — they would appear in plaintext in Lambda environment variables which are visible in the AWS console.

### Step 3 — Wire `envVars` to Terraform outputs

The `lambda-runner` Terraform module reads the `envVars` list from each task and resolves the values from its input map. In `infra/environments/{env}/main.tf`, the lambda-runner module receives a map of all available env var values:

```hcl
module "lambda_runner" {
  source = "../../modules/lambda-runner"

  # ... existing config ...

  resolved_env_vars = local.resolved_infra_vars
}
```

The `local.resolved_infra_vars` map (defined in `locals.tf`) includes all infra references. Add any new plain env vars your script needs to that map.

---

## Part 3 — Task Execution Order

Tasks in `deployTasks[]` execute **sequentially in array order**. Place Prisma migrations before any seeds that depend on the schema existing:

```json
{
  "deployTasks": [
    {
      "name": "order-prisma-migrate",
      "type": "prisma-migrate",
      "domain": "order",
      "secretEnvVars": ["ORDERS_DATABASE_URL"],
      "envVars": []
    },
    {
      "name": "seed-products",
      "type": "custom-script",
      "script": "seed-products.mjs",
      "secretEnvVars": [],
      "envVars": ["PRODUCTS_DYNAMODB_TABLE_NAME"]
    }
  ]
}
```

---

## Part 4 — Testing Deploy Tasks Locally

The init-runner cannot be run locally against LocalStack in a meaningful way (it expects real AWS credentials and VPC connectivity). Test your script logic independently:

```powershell
# For custom scripts — run directly against LocalStack
$env:AWS_DEFAULT_REGION = "eu-west-2"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:{DOMAIN}_DYNAMODB_TABLE_NAME = "OldSTTable"

node infra/init-runner/scripts/seed-{domain}.mjs
```

For Prisma migrations, test with `prisma migrate dev` locally (see Prisma workflow in the main instructions).

---

## Checklist

**For `prisma-migrate`:**
- [ ] `deployTasks[]` entry added to `service-registry.json` with correct `domain` and `secretEnvVars`
- [ ] `cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/` line added to the `Package init-runner` step in `.github/workflows/cd-deploy.yml`
- [ ] `{DOMAIN}_DATABASE_URL` is included in the Secrets Manager secret assembly in Terraform
- [ ] RDS module is referenced in `resolved_env_vars` or equivalent wiring (handled automatically if rds entry is in registry)

**For `custom-script`:**
- [ ] Script file created in `infra/init-runner/scripts/` as a `.mjs` file
- [ ] Script validates all required env vars before doing work and throws if missing
- [ ] `deployTasks[]` entry added with correct `script`, `secretEnvVars`, and `envVars`
- [ ] Any new plain env vars added to `local.resolved_infra_vars` in the environment's `locals.tf`
- [ ] Script tested locally against LocalStack (for DynamoDB scripts) before deploying
