# Infrastructure — Data-Driven Terraform

This directory contains all Terraform code for deploying the application stack to AWS. The setup is **data-driven** — `service-registry.json` drives resource creation, so most changes require zero `.tf` file edits.

## Directory Structure

```
infra/
├── bootstrap/             ← One-time per-account setup (state bucket, OIDC, IAM)
├── init-runner/           ← ECS Fargate one-shot deploy task container (Dockerfile + entrypoint)
├── modules/               ← Reusable child modules (one resource per invocation)
│   ├── networking/        ← VPC, subnets, NAT, security groups
│   ├── cognito/           ← Cognito User Pool + App Client
│   ├── dynamodb/          ← DynamoDB table + GSIs
│   ├── rds/               ← RDS PostgreSQL
│   ├── sqs/               ← SQS queue + DLQ pair
│   ├── s3/                ← S3 bucket
│   ├── api-gateway/       ← Shared API Gateway HTTP API v2 (one per environment)
│   ├── lambda-api/        ← Lambda + route on shared API Gateway
│   ├── lambda-worker/     ← Lambda + SQS event source mapping
│   ├── static-webapp/     ← S3 + CloudFront for static Next.js export (default for all envs)
│   ├── lambda-webapp/     ← Webapp deployed as Lambda container image (legacy SSR)
│   ├── webapp/            ← ECS Fargate + ALB (legacy SSR, staging/prod)
│   ├── init-runner/       ← ECS Fargate one-shot task wiring (deploy tasks)
│   ├── secrets/           ← Secrets Manager (random password)
│   ├── notifications/     ← SNS topic + email subs + AWS Chatbot Slack
│   └── monitoring/        ← CloudWatch alarms (publishes to notifications SNS)
└── environments/          ← Root modules (own state, compose modules)
    ├── dev/
    ├── staging/
    ├── prod/
    └── preview/           ← Ephemeral full-stack preview environments
```

## How It Works

### Data-Driven Pattern

`.github/service-registry.json` is the single source of truth. Terraform reads it at plan time:

```hcl
locals {
  registry = jsondecode(file("${path.module}/../../../.github/service-registry.json"))
}

module "api_services" {
  source   = "../../modules/lambda-api"
  for_each = { for svc in local.registry.apiServices : svc.name => svc }
  # ... all config derived from the registry entry
}
```

### What Can Developers Change Without Editing Terraform?

| Change | Update | TF files changed? |
|---|---|---|
| New API service | `service-registry.json` + app code | **None** |
| New event handler service | `service-registry.json` + app code | **None** |
| New DynamoDB table or GSI | `service-registry.json` | **None** |
| New SQS queue | `service-registry.json` | **None** |
| New S3 bucket | `service-registry.json` | **None** |
| Env var added/removed | `service-registry.json` | **None** |
| Lambda memory/timeout | `service-registry.json` | **None** |

### Env Var Wiring (`resolved_vars`)

Environment roots build a `resolved_vars` map that automatically wires Terraform outputs to service env var names:

```hcl
locals {
  resolved_vars = merge(
    # DynamoDB table names
    { for t in local.registry.infrastructure.dynamodbTables :
      t.envVar => module.dynamodb[t.domain].table_name },
    # SQS queue URLs
    { for q in local.registry.infrastructure.sqsQueues :
      q.envVar => module.sqs[q.envVar].queue_url },
    # ... etc
  )
}
```

Each service's `envVars` array is iterated, and values are looked up from this map.

## Getting Started

### Prerequisites

1. **AWS CLI** configured with admin credentials
2. **Terraform** >= 1.6.0
3. **Docker** (for webapp builds)
4. **GitHub CLI** (`gh`) authenticated

### First-Time Setup

#### Setup Flow

```
  ┌───────────────┐
  │  New Project   │
  └───────┬───────┘
          ▼
  ┌───────────────────────────────────┐
  │  Single account or multi-account? │
  └───────┬──────────────┬────────────┘
          ▼              ▼
  ┌──── Option A ────┐  ┌──────── Option B (recommended) ────────┐
  │                   │  │                                        │
  │  1. aws-credentials│  │  1. aws-credentials.dev/.staging/.prod│
  │  2. terraform.tfvars│ │  2. terraform.tfvars                  │
  │  3. Bootstrap Init│  │  For each env (dev → staging → prod): │
  │  4. Bootstrap Apply│ │    3. Bootstrap Init → select env      │
  │  5. Setup GitHub  │  │    4. Bootstrap Apply → select env     │
  │     Variables     │  │    5. Setup GitHub Env Vars → select env│
  │                   │  │                                        │
  └─────────┬─────────┘  └──────────────────┬─────────────────────┘
            ▼                               ▼
  ┌──────────────────────────────────────────────────┐
  │  git push origin develop  →  auto-deploys ✓     │
  └──────────────────────────────────────────────────┘
```

> **Full step-by-step details** with credential file format and `terraform.tfvars` examples are in [`bootstrap.md`](bootstrap.md).

#### Single-Account (all environments in one AWS account)

| Step | Action |
|---|---|
| 1 | Copy `infra/bootstrap/aws-credentials.example` → `aws-credentials`, fill in credentials |
| 2 | Create `infra/bootstrap/terraform.tfvars` with `project_name`, `github_org`, `github_repo`, `aws_region` |
| 3 | Run VS Code task: **`AWS: Bootstrap Init`** → select `default` |
| 4 | Run VS Code task: **`AWS: Bootstrap Apply`** → select `default` |
| 5 | Run VS Code task: **`AWS: Setup GitHub Repo Variables`** → select `default` |
| 6 | `git push origin develop` → auto-deploys to dev |

#### Multi-Account (one AWS account per environment — recommended)

| Step | Action |
|---|---|
| 1 | Copy `aws-credentials.example` → `aws-credentials.dev`, `aws-credentials.staging`, `aws-credentials.prod` — fill each with that account's credentials |
| 2 | Create `infra/bootstrap/terraform.tfvars` with `project_name`, `github_org`, `github_repo`, `aws_region` |
| 3 | **For each env** (dev, staging, prod): Run **`AWS: Bootstrap Init`** → select env |
| 4 | **For each env**: Run **`AWS: Bootstrap Apply`** → select env |
| 5 | **For each env**: Run **`AWS: Setup GitHub Environment Variables`** → select env |
| 6 | `git push origin develop` → auto-deploys to dev account |

The `AWS: Setup GitHub Environment Variables` task auto-creates the GitHub environment, reads bootstrap outputs, and sets environment-scoped variables. No manual GitHub Settings changes needed.

### Deployment Flow

```
  Triggers                          CD: Deploy Pipeline
  ───────────────────               ─────────────────────────────────────────────────────
  Push to develop ──▶ dev    ──┐
  Push to main    ──▶ staging ─┤    Detect     Build       Terraform   Deploy     Deploy
  Manual dispatch ──▶ any env ─┴──▶ affected ─▶ Lambda  ─▶ apply    ─▶ tasks  ─▶ Lambda ─▶ webapp
                                    services    ZIPs       (infra)    (migrate)  functions  (ECS)
```

### Manual Deploy

Use the "CD: Deploy" workflow in GitHub Actions:
- Select environment (dev/staging/prod)
- Enter AWS Account ID
- Choose to deploy all or only affected services

### Preview Environments

Preview environments are fully isolated (own tables, queues, RDS instance, Lambda functions, ECS service). They use the same Terraform root (`infra/environments/preview/`) with different state keys — zero repo files per preview.

#### Create a preview (VS Code)

Run the VS Code task **`Preview: Create`**. You will be prompted for:
- **Preview name** (e.g. `john-feature-x`)
- **Target account** (dev/staging/prod) — which AWS account to deploy into
- **Enable VPC** (required for Prisma-based services)
- **Enable webapp** (deploys Next.js via ECS)

The task resolves `AWS_ACCOUNT_ID`, `TFSTATE_BUCKET`, and `TFSTATE_LOCK_TABLE` from the selected GitHub environment variables automatically.

#### Create a preview (CLI)

```bash
gh workflow run "CD: Preview — Create" \
  -f preview_name=john-feature-x \
  -f ref=feature/my-branch \
  -f aws_account_id=123456789012 \
  -f enable_webapp=false
```

#### Destroy a preview

Run the VS Code task **`Preview: Destroy`**, or:

```bash
gh workflow run "CD: Preview — Destroy" \
  -f preview_name=john-feature-x \
  -f aws_account_id=123456789012
```

> **Important:** Destroy must target the **same account** the preview was created in — that's where the Terraform state lives.

## Environment Defaults

| Setting | Dev | Staging | Prod | Preview |
|---|---|---|---|---|
| RDS instance | db.t4g.micro | db.t4g.small | db.t4g.medium (Multi-AZ) | db.t4g.micro |
| Lambda memory | Registry value | Registry value | Registry value | Capped at 256MB |
| Log retention | 14 days | 30 days | 90 days | 7 days |
| PITR (DynamoDB) | Yes | Yes | Yes | No |
| Monitoring | Yes | Yes | Yes | No |
| ECS auto-scaling | No | Yes (2) | Yes (8) | No |
| Deletion protection | Yes | Yes | Yes | No |

## Adding a New Domain

1. Add entries to `.github/service-registry.json`:
   - API service in `apiServices`
   - Event handler in `eventHandlerServices`
   - DynamoDB table in `infrastructure.dynamodbTables` (if applicable)
   - RDS PostgreSQL database in `infrastructure.rds` (if applicable)
   - SQS queue in `infrastructure.sqsQueues`

2. Include the env var names each service needs in the `envVars` arrays

3. Push — Terraform `for_each` sees the new entries and creates everything

No `.tf` files need to be modified.
