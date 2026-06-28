# Deployment Guide

This guide covers everything you need to go from a fresh repository to a working AWS deployment.

---

## Overview

Backend services deploy as **Lambda ZIP packages** connected to a shared **API Gateway HTTP API v2**. The webapp deploys as a **static export** (`next export`) served from **S3 + CloudFront** — no Docker container or server process required. All infrastructure is described in Terraform and driven by `.github/service-registry.json` — adding a new service, table, or queue requires only a JSON edit.

Authentication to AWS in CI/CD uses **GitHub OIDC** — no AWS credentials are ever stored as GitHub secrets.

```
Developer push
      │
      ▼
GitHub Actions
  ├── terraform apply           (creates/updates all AWS resources)
  ├── build Lambda ZIPs         (affected services only)
  ├── ECS init-runner           (Prisma migrations, seed data)
  └── deploy Lambdas + webapp
              │
              ▼
         AWS Account
  ├── API Gateway (shared, all services)
  ├── Lambda functions (one per service)
  ├── S3 + CloudFront (static webapp)
  ├── RDS PostgreSQL (Prisma domains)
  ├── DynamoDB (DynamoDB domains)
  ├── SQS queues (event-driven services)
  ├── Cognito User Pool (auth)
  └── S3 (file uploads + artifact storage)
```

---

## Prerequisites

Before bootstrapping, you need:

- **AWS account(s)** — one per environment (dev/staging/prod) is recommended
- **AWS CLI** installed and able to assume temporary credentials
- **Terraform ≥ 1.5** installed locally
- **GitHub repository** created with Actions enabled
- **`gh` CLI** installed and authenticated (`gh auth login`)

---

## 1. Understand the Bootstrap

The `infra/bootstrap/` directory contains a one-time Terraform module that creates the infrastructure needed by the CD pipeline itself:

| Resource | Purpose |
|---|---|
| S3 bucket | Terraform remote state storage |
| DynamoDB table | Terraform state locking |
| S3 bucket | Lambda ZIP artifact storage |
| ECR repository | Docker images for the webapp |
| OIDC identity provider | GitHub Actions → AWS trust relationship |
| IAM deploy role | Role assumed by GitHub Actions via OIDC |

**This is run once per AWS account.** After bootstrap, you never need to run it again unless you create a new account or lose the resources.

---

## 2. Set Up Credentials

Bootstrap requires temporary AWS credentials. The credential file is gitignored and never committed.

```bash
cd infra/bootstrap

# Copy the example file
cp aws-credentials.example aws-credentials
```

Fill in `aws-credentials` with your temporary credentials:

```dotenv
AWS_ACCESS_KEY_ID=ASIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...    # Only required for SSO/assume-role credentials
```

> **Tip:** For organisations using AWS SSO, run `aws sso login --profile your-profile` and then copy the exported credentials.

---

## 3. Create `terraform.tfvars`

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_name = "your-project-name"   # Used as prefix for all AWS resource names
github_org   = "YourGitHubOrg"       # GitHub organisation or username
github_repo  = "your-repo-name"      # Repository name (without org prefix)
aws_region   = "eu-west-2"           # Target AWS region
environment  = "dev"                 # Only needed for multi-account setups
```

---

## 4. Choose: Single Account or Multi-Account

### Option A — Single Account (simplest)

All environments (dev/staging/prod) share one AWS account. Good for early-stage projects.

```bash
# From infra/bootstrap/
# Run VS Code task: "AWS: Bootstrap Init" → select "default"
# Then: "AWS: Bootstrap Apply" → select "default"
# Then: "AWS: Setup GitHub Repo Variables" → select "default"
```

Or run manually:

```bash
terraform init
terraform apply \
  -var="project_name=your-project" \
  -var="github_org=YourOrg" \
  -var="github_repo=your-repo" \
  -var="aws_region=eu-west-2"
```

This sets **repo-level** GitHub variables (`PROJECT_NAME`, `AWS_ACCOUNT_ID`, `AWS_REGION`, `ARTIFACT_BUCKET`, `ECR_REPO_URL`).

### Option B — Multi-Account (recommended)

Each environment has its own AWS account. Best practice for production workloads.

Repeat bootstrap for each account:

```bash
# DEV account (switch to dev credentials first):
terraform init
terraform apply \
  -var="project_name=your-project" \
  -var="environment=dev" \
  -var="github_org=YourOrg" \
  -var="github_repo=your-repo"

# Run VS Code task: "AWS: Setup GitHub Environment Variables" → select "dev"

# STAGING account (switch to staging credentials):
terraform init -reconfigure
terraform apply \
  -var="project_name=your-project" \
  -var="environment=staging" \
  -var="github_org=YourOrg" \
  -var="github_repo=your-repo"

# Run VS Code task: "AWS: Setup GitHub Environment Variables" → select "staging"

# PROD account (switch to prod credentials):
terraform init -reconfigure
terraform apply \
  -var="project_name=your-project" \
  -var="environment=prod" \
  -var="github_org=YourOrg" \
  -var="github_repo=your-repo"

# Run VS Code task: "AWS: Setup GitHub Environment Variables" → select "prod"
```

The `AWS: Setup GitHub Environment Variables` VS Code task:
1. Reads Terraform outputs (bucket names, ECR URL, account ID)
2. Auto-creates the GitHub environment (`dev`, `staging`, `prod`) via GitHub API
3. Sets environment-scoped variables so each deployment job uses the right account

---

## 5. What Gets Set in GitHub

**Repo-level variables** (single account) or **environment-scoped variables** (multi-account):

| Variable | Purpose |
|---|---|
| `PROJECT_NAME` | Prefixes all AWS resource names |
| `AWS_ACCOUNT_ID` | Target AWS account number |
| `AWS_REGION` | Deployment region |
| `ARTIFACT_BUCKET` | S3 bucket for Lambda ZIPs |
| `ECR_REPO_URL` | ECR repository for webapp Docker images |
| `TFSTATE_BUCKET` | S3 bucket for Terraform state |
| `TFSTATE_LOCK_TABLE` | DynamoDB table for state locking |

These are **variables** (not secrets) — they are not sensitive and can be viewed in GitHub Settings.

---

## 6. The `DEPLOY_ENABLED` Sentinel

Push-triggered deployments are **blocked by default** until you explicitly enable them per environment. This prevents accidental deploys when first setting up a new environment.

To allow push-triggered deploys for an environment:

1. Go to **GitHub → Settings → Environments → {env}**
2. Add variable: `DEPLOY_ENABLED = true`

> Manual dispatch deployments (`workflow_dispatch`) always run regardless of `DEPLOY_ENABLED`.

---

## 7. Secrets Management (`SENSITIVE_VARS`)

Database passwords and other sensitive values are managed via AWS Secrets Manager. You declare them once as a GitHub secret and they flow to Secrets Manager automatically via Terraform.

### How it works

1. Create a file `infra/bootstrap/github-secrets` (gitignored) with your sensitive values:

```dotenv
ORDERS_DATABASE_PASSWORD=your-secure-password
SOME_API_KEY=your-api-key
```

2. The `AWS: Bootstrap Apply` VS Code task reads this file and creates a `SENSITIVE_VARS` GitHub secret containing the JSON-encoded values.

3. The CD workflow passes `SENSITIVE_VARS` to Terraform, which writes selected keys to a per-environment Secrets Manager secret.

4. Lambda services read their secrets at cold-start via `SecretsConfig.resolve(['ORDERS_DATABASE_URL'])` (from `@old-st/aws-secrets`).

> **Never hardcode secrets in `.tf` files, workflow YAML, or application code.**

---

## 8. First Deployment

Once bootstrap is complete and variables are set:

```bash
git push origin develop
```

The `CD: Deploy` workflow runs automatically (if `DEPLOY_ENABLED=true`) and:

1. **Preflight** — validates GitHub variables are set
2. **Detect changes** — uses Nx to find affected services
3. **Terraform apply** — creates all AWS resources from `service-registry.json`
4. **Build backend** — packages affected Lambda ZIPs
5. **Run init tasks** — Prisma migrations, seed data (via ECS init-runner)
6. **Deploy** — uploads Lambda ZIPs + builds/pushes webapp Docker image
7. **Smoke test** — hits `/health` on every service; posts summary to GitHub Step Summary

### Manual dispatch (force deploy all)

```bash
# From GitHub Actions UI → "CD: Deploy" → "Run workflow"
# Or via CLI:
gh workflow run "CD: Deploy" \
  -f environment=dev \
  -f deploy_all=true     # Force deploy all services, not just affected
```

---

## 9. Preview Environments

Preview environments are fully isolated ephemeral deployments — own DynamoDB tables, RDS PostgreSQL instance, SQS queues, Lambda functions, ECS service.

### Create a preview

```bash
# Via VS Code task: "Preview: Create"
# Or via CLI:
gh workflow run "CD: Preview — Create" \
  -f preview_name=john-feature-x \
  -f ref=feature/my-branch \
  -f aws_account_id=123456789012

# With webapp (full-stack):
gh workflow run "CD: Preview — Create" \
  -f preview_name=john-feature-x \
  -f ref=feature/my-branch \
  -f aws_account_id=123456789012 \
  -f enable_webapp=true
```

### Destroy a preview

```bash
# Via VS Code task: "Preview: Destroy"
# Or via CLI:
gh workflow run "CD: Preview — Destroy" \
  -f preview_name=john-feature-x \
  -f aws_account_id=123456789012
```

### Preview settings

| Setting | Value |
|---|---|
| Lambda memory | Capped at 256MB |
| RDS instance class | db.t4g.micro |
| Log retention | 7 days |
| Deletion protection | Disabled |
| State isolation | `preview/{name}/terraform.tfstate` in S3 |

---

## 10. Tearing Down Environments

> ⚠️ This is **irreversible**. All data will be deleted.

The `cd-destroy.yml` workflow permanently tears down an entire environment and all its AWS resources.

```bash
# Via VS Code task: "Environment: Destroy"
# Or via CLI (requires double-confirmation):
gh workflow run "CD: Destroy" \
  -f environment=dev \
  -f confirm=destroy-dev
```

The `confirm` parameter must match `destroy-{environment}` — this double-confirmation prevents accidental destruction.

---

## 11. Adding a New Service or Infrastructure Resource

The service registry pattern means most additions require **zero Terraform edits**.

### Add a new API service

Edit `.github/service-registry.json` → `apiServices` array:

```json
{
  "name": "payment-api-service",
  "distPath": "dist/apps/payments/payment-api-service/main.js",
  "domain": "payments",
  "type": "api",
  "handler": "handler",
  "memorySize": 512,
  "timeout": 30,
  "envVars": ["PAYMENTS_DATABASE_URL"],
  "requiresVpc": true
}
```

Add the env var section to `.github/service-registry.env`:

```dotenv
PAYMENT_SERVICE_PORT=3005
API_PAYMENT_URL=http://localhost:3005/api
NEXT_PUBLIC_API_PAYMENT_URL=http://localhost:3005/api
PAYMENTS_DATABASE_URL=postgresql://dev:dev@localhost:5432/payments_db
```

Terraform automatically creates the Lambda function and API Gateway route on the next `terraform apply`.

### Add a DynamoDB table

```json
// .github/service-registry.json → infrastructure.dynamodbTables
{
  "name": "PAYMENTS",
  "envVar": "PAYMENTS_DYNAMODB_TABLE_NAME",
  "gsis": [
    { "name": "GSI1", "pk": "GSI1PK", "sk": "GSI1SK" }
  ]
}
```

### Add an SQS queue

```json
// .github/service-registry.json → infrastructure.sqsQueues
{
  "name": "payment-events",
  "envVar": "PAYMENT_EVENTS_SQS_QUEUE_URL"
}
```

### Add an S3 bucket

```json
// .github/service-registry.json → infrastructure.s3Buckets
{
  "name": "files",
  "envVar": "FILES_S3_BUCKET_NAME"
}
```

See [`cd-register-service`](.claude/skills/cd-register-service/SKILL.md) skill for the complete checklist.

---

## 12. Monitoring Deployments

The monitoring service (dashboard + API) deploys **independently** from the main application pipeline via the `CD: Monitoring Deploy` workflow. It consists of two Lambda functions using [Lambda Web Adapter](https://github.com/aws/aws-lambda-web-adapter):

- **monitoring-api-service** — observability gateway over CloudWatch, X-Ray, and alarms (Lambda ZIP)
- **monitoring-webapp** — Next.js dashboard (Lambda container image, same approach as main webapp)

### Prerequisites

1. **Bootstrap** — Run `infra/bootstrap/` once per AWS account. This creates the monitoring OIDC deploy role (`monitoring_deploy_role_arn` output) and the monitoring-webapp ECR repository (`monitoring_ecr_repo_url` output).
2. **`AWS: Setup GitHub Repo Variables`** — This VS Code task automatically reads bootstrap outputs (including `MONITORING_DEPLOY_ROLE_ARN` and `MONITORING_ECR_REPO_URL`) and sets them as GitHub repo variables.
3. **First deploy with `deploy_infra=true`** — Terraform creates both Lambda functions, Function URLs, IAM role, and log groups automatically. No manual Lambda creation needed.
4. **`MONITORING_API_URL`** — Automatically set by the infra job after Terraform apply (reads the Function URL output and stores it as a GitHub variable). No manual step needed.

### GitHub OAuth Setup

The monitoring dashboard uses GitHub OAuth to restrict access to org members.

1. Create a **GitHub OAuth App** (Settings → Developer settings → OAuth Apps → New):
   - Authorization callback URL: `{MONITORING_API_URL}/api/auth/github/callback` (get the URL from `terraform output monitoring_api_function_url`)
   - Homepage URL: `terraform output monitoring_webapp_function_url`
2. Set these as **Lambda environment variables** on `{project}-{env}-monitoring-api`. You can either:
   - Pass them via the `monitoring_api_env_vars` Terraform variable (recommended — survives redeploys), or
   - Set them via the AWS CLI / Console (quick but overwritten on next `terraform apply` if the variable is empty)

| Variable | Value |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_REQUIRED_ORG` | GitHub org slug (users must be active members) |
| `MONITORING_JWT_SECRET` | Random secret for signing monitoring JWTs |
| `MONITORING_WEBAPP_URL` | Function URL of the monitoring-webapp Lambda |
| `MONITORING_API_BASE_URL` | Function URL of the monitoring-api Lambda |

### VS Code Tasks

| Task | What it does |
|---|---|
| `Monitoring Deploy: Trigger` | Trigger monitoring deployment (choose infra/API/webapp) |
| `Monitoring Deploy: Status` | Show recent monitoring deploy workflow runs |
| `Monitoring Deploy: Logs` | Stream logs from the most recent monitoring deploy |

### CLI

```bash
# Trigger full monitoring deploy to dev
gh workflow run "CD: Monitoring Deploy" \
  -f environment=dev \
  -f aws_account_id=123456789012 \
  -f deploy_infra=true \
  -f deploy_api=true \
  -f deploy_webapp=true

# List recent monitoring deploys
gh run list --workflow="CD: Monitoring Deploy" --limit 5

# Get Function URLs after first deploy
cd infra/environments/monitoring
terraform output monitoring_api_function_url
terraform output monitoring_webapp_function_url
```

### Setting GitHub OAuth via Terraform (Recommended)

To persist OAuth env vars across redeploys, pass them via `-var` or a `.tfvars` file:

```bash
terraform apply \
  -var='monitoring_api_env_vars={"GITHUB_CLIENT_ID":"Iv1.xxx","GITHUB_CLIENT_SECRET":"xxx","GITHUB_REQUIRED_ORG":"your-org","MONITORING_JWT_SECRET":"random-secret","MONITORING_WEBAPP_URL":"https://xxx.lambda-url.eu-west-2.on.aws","MONITORING_API_BASE_URL":"https://yyy.lambda-url.eu-west-2.on.aws"}'
```

Or create `infra/environments/monitoring/terraform.tfvars` (gitignored — contains secrets):

```hcl
monitoring_api_env_vars = {
  GITHUB_CLIENT_ID      = "Iv1.xxx"
  GITHUB_CLIENT_SECRET  = "xxx"
  GITHUB_REQUIRED_ORG   = "your-org"
  MONITORING_JWT_SECRET  = "random-secret"
  MONITORING_WEBAPP_URL  = "https://xxx.lambda-url.eu-west-2.on.aws"
  MONITORING_API_BASE_URL = "https://yyy.lambda-url.eu-west-2.on.aws"
}
```

### Local Development

Add to `.env.local`:

```env
MONITORING_API_PORT=8080
MONITORING_API_BASE_URL=http://localhost:8080
MONITORING_WEBAPP_URL=http://localhost:4300
MONITORING_JWT_SECRET=local-dev-secret
GITHUB_CLIENT_ID=<your-oauth-app-client-id>
GITHUB_CLIENT_SECRET=<your-oauth-app-client-secret>
GITHUB_REQUIRED_ORG=<your-github-org-slug>
NEXT_PUBLIC_MONITORING_API_URL=http://localhost:8080
```

Create the GitHub OAuth App with callback URL `http://localhost:8080/api/auth/github/callback`, then run the **`Monitoring: Start All`** VS Code task.

---

## 13. Troubleshooting

### "Resource not accessible by integration" in GitHub Actions

Your workflow is missing a permissions block. Add to any workflow using `nrwl/nx-set-shas@v4`:

```yaml
permissions:
  actions: read
  contents: read
```

### Lambda crashes with "Cannot find module"

The `libraryTarget: 'commonjs2'` is missing from `webpack.config.js`. Every service must have:

```js
output: {
  libraryTarget: 'commonjs2',
}
```

### Prisma "unable to locate libquery_engine" in CI

Add `pnpm prisma:{domain}:generate` step after `Install dependencies` in your CI workflows. The Linux engine binary must be generated on the CI runner.

### Cognito auth errors in deployed env

Check that `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, and `COGNITO_REGION` are set in your Lambda env vars. These are declared in the service's `envVars` array in `service-registry.json` and must also exist in the Secrets Manager secret referenced by `AWS_SECRETS_ARN`.

### Preview environment fails to create

Verify:
- The preview name contains only lowercase letters, numbers, and hyphens
- The target AWS account has bootstrap resources (OIDC provider, deploy role)
- `TFSTATE_BUCKET` variable is set for the target account/environment

### `DEPLOY_ENABLED` not set — push triggers are skipped

Set `DEPLOY_ENABLED=true` as an environment-scoped variable in GitHub Settings → Environments → {env}.

---

## Related Documentation

- [Architecture reference](CLAUDE.md)
- [Infrastructure Terraform README](infra/README.md)
- [Bootstrap README](infra/bootstrap/README.md)
- [Service registry reference](.github/service-registry.json)
- [CD register service skill](.claude/skills/cd-register-service/SKILL.md)
- [Testing guide](TESTING_GUIDE.md)
