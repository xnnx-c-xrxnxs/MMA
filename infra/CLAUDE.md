# Infrastructure (Terraform) Context

This file loads automatically for any file inside `infra/`. It enforces the **data-driven Terraform** pattern that makes adding services / tables / queues a JSON-only change.

---

## Golden Rule

> **Most service additions require ZERO `.tf` file edits.** Add a JSON entry to `.github/service-registry.json` and Terraform creates everything via `for_each`.

If you find yourself writing custom Terraform for a new API service, DynamoDB table, SQS queue, RDS database, or S3 bucket — **stop**. The pattern is wrong. Use `service-registry.json` instead.

The only times new `.tf` code is needed:
- Adding an entirely new AWS service type (e.g. ElastiCache, SES) → use the **`infra-new-module`** skill
- Wiring custom one-off Lambdas (monitoring tool, init-runner) → reference existing patterns
- Adding new alarm types or notification channels → use **`add-monitoring`** or **`add-notifications`** skills

---

## Layout

```
infra/
├── bootstrap/             ← One-time per AWS account: state bucket, OIDC, IAM
├── init-runner/           ← ECS Fargate one-shot deploy task (Dockerfile + entrypoint)
├── modules/               ← Reusable child modules (15 modules)
│   ├── networking/        ← VPC, subnets, NAT, security groups
│   ├── cognito/           ← Cognito User Pool + App Client
│   ├── dynamodb/          ← DynamoDB table + GSIs
│   ├── rds/               ← RDS PostgreSQL
│   ├── sqs/               ← SQS queue + DLQ pair
│   ├── s3/                ← S3 bucket
│   ├── api-gateway/       ← Shared API Gateway HTTP API v2
│   ├── lambda-api/        ← Lambda + route on shared API Gateway
│   ├── lambda-worker/     ← Lambda + SQS event source mapping
│   ├── static-webapp/     ← S3 + CloudFront for static Next.js export (default for all envs)
│   ├── lambda-webapp/     ← Webapp deployed as Lambda container image (legacy SSR)
│   ├── webapp/            ← ECS Fargate + ALB (legacy SSR, staging/prod)
│   ├── init-runner/       ← ECS Fargate one-shot task wiring
│   ├── secrets/           ← Secrets Manager (random password)
│   ├── notifications/     ← SNS topic + email subs + AWS Chatbot Slack
│   └── monitoring/        ← CloudWatch alarms (publishes to notifications SNS)
└── environments/
    ├── dev/
    ├── staging/
    ├── prod/
    └── preview/           ← Parameterized — state in S3 key: preview/{name}/terraform.tfstate
```

---

## Critical Patterns

### 1. Service Registry Drives Resource Creation

```hcl
# infra/environments/dev/main.tf
locals {
  registry = jsondecode(file("${path.module}/../../../.github/service-registry.json"))
}

module "api_services" {
  source   = "../../modules/lambda-api"
  for_each = { for svc in local.registry.apiServices : svc.name => svc }

  service        = each.value
  api_gateway_id = module.api_gateway.api_id
  # ...
}
```

Every environment root reads the same `service-registry.json`. Adding a service to the JSON immediately creates it in every environment on the next `terraform apply`.

### 2. Webapp Three-Mode Deployment (static / ecs / lambda)

`webapp.deploymentMode` in `service-registry.json` is a per-environment map. **`"static"` is the default for all environments** — the webapp is built as a static export and served from S3 + CloudFront:

```json
"webapp": {
  "deploymentMode": {
    "dev":     "static",
    "preview": "static",
    "staging": "static",
    "prod":    "static"
  }
}
```

In each environment root:

```hcl
locals {
  webapp_mode = local.registry.webapp.deploymentMode[var.environment]
}

module "static_webapp" {
  source = "../../modules/static-webapp"
  count  = local.webapp_mode == "static" ? 1 : 0
  # ...
}

module "webapp" {
  source = "../../modules/webapp"
  count  = local.webapp_mode == "ecs" ? 1 : 0
  # ...
}

module "webapp_lambda" {
  source = "../../modules/lambda-webapp"
  count  = local.webapp_mode == "lambda" ? 1 : 0
  # ...
}
```

The `static-webapp` module creates a private S3 bucket + CloudFront distribution with OAC + SPA routing (403/404 → `/index.html`). No Docker image, no ECR, no ALB. `"ecs"` and `"lambda"` modes are legacy/SSR paths.

Switching to static mode from ECS/Lambda destroys the ALB or Function URL — DNS endpoint changes. Update DNS and OAuth callbacks accordingly.

### 3. Multi-Account: Resource Names Suffixed by Environment

The bootstrap module uses `var.environment` to suffix globally-unique resources (S3 buckets) so multiple AWS accounts can coexist with the same project name. Single-account setups omit `var.environment` for backward compatibility.

### 4. State Isolation

| Environment | State location |
|---|---|
| `dev` | `s3://{bucket}/dev/terraform.tfstate` |
| `staging` | `s3://{bucket}/staging/terraform.tfstate` |
| `prod` | `s3://{bucket}/prod/terraform.tfstate` |
| `preview/{name}` | `s3://{bucket}/preview/{name}/terraform.tfstate` |
| `monitoring/{env}` | `s3://{bucket}/monitoring/{env}/terraform.tfstate` |

Never share state files across environments. Never run `terraform apply` from a developer machine for `staging` or `prod` — those are CD-only.

### 5. Resource Address Stability (DO NOT RENAME)

Some Terraform resource addresses use historical names that don't match their current purpose (e.g. `aws_security_group.aurora` after Aurora was replaced by RDS PostgreSQL). **Do not rename these addresses** — Terraform sees a rename as `destroy + create`, which destroys live infrastructure (RDS instances, ALBs, etc.).

When you encounter a stale resource name:
1. Update the `description` and `tags` to reflect current usage.
2. Leave the resource address alone.
3. Add a `# TODO` comment explaining why the old name remains.

To actually rename a resource, use `terraform state mv` in a separate change after coordinating with the team.

---

## When Editing Modules

Modules are **shared across all environments**. A module change that breaks dev WILL break prod on the next deploy. Rules:

1. **Backward-compatible variable additions only.** New variables must have `default = ""` or `default = []` so existing environment roots that don't pass them keep working.
2. **`terraform plan` against ALL environments before committing.** Run from `infra/environments/dev/`, `staging/`, `prod/`. The `cd-infra-plan.yml` workflow does this on PRs.
3. **No `aws_db_instance` / `aws_rds_cluster` `delete_protection` removal in dev** without explicit team agreement — accidental destroy of dev is annoying but recoverable; staging/prod requires double-confirmation.

---

## Bootstrap

The `infra/bootstrap/` module is **separate** — it creates the resources that `infra/environments/*` depends on:
- S3 state bucket + DynamoDB lock table
- ECR repos (webapp, monitoring-webapp)
- OIDC provider + IAM deploy role
- S3 artifact bucket

Bootstrap runs **once per AWS account** locally. Re-running it is safe (idempotent) but not normally needed. See `docs/bootstrap.md` for the full walkthrough.

---

## CD / Deployment Rules

38. **`.github/service-registry.json` is the single source of truth for both CI and CD.** All Terraform environment roots read it via `jsondecode(file(...))` and create resources with `for_each`. Adding a service = update the registry; do not edit `.tf` files for routine additions.
39. **Never hardcode service/table/queue names or env vars in Terraform.** All resource creation iterates over `service-registry.json`. The only `.tf` edits needed are when an entirely new module type is introduced (rare).
40. **The `monitoring-webapp` Dockerfile requires `output: 'standalone'`.** The main webapp uses `output: 'export'` for static S3 + CloudFront deployment — no Dockerfile. These are different modes; don't swap them.
41. **Preview environments are parameterized, not file-per-developer.** One `infra/environments/preview/` serves all; state is isolated via S3 key `preview/{preview_name}/terraform.tfstate`.
42. **AWS authentication in CD uses GitHub OIDC — never store AWS credentials as GitHub secrets.** Bootstrap creates an OIDC provider + IAM deploy role; workflows use `aws-actions/configure-aws-credentials@v4` with `role-to-assume`.
43. **Every HTTP API service must expose `GET /api/health` returning `{ status: 'ok', service: '{service-name}' }`** — via `@Get('health')` (never `@Get()`), decorated `@Public()`, method named `health()`. The CD smoke test accepts only HTTP `200`. See `nestjs-service-layers` §2.

## Anti-Patterns

- ❌ Hardcoding service names, table names, or queue names in `.tf` files (use `for_each` over `service-registry.json`)
- ❌ Adding a new `module "{service-name}"` block per service (use `for_each` over the registry)
- ❌ Creating per-developer `infra/environments/preview-alice/` directories (use the parameterized `preview/` directory)
- ❌ Storing AWS credentials in GitHub secrets (use OIDC + `aws-actions/configure-aws-credentials@v4` with `role-to-assume`)
- ❌ Renaming resource addresses on live infrastructure (use `terraform state mv` separately, or leave the name alone)
- ❌ Running `terraform apply` against staging/prod from a developer machine (CI/CD only)
- ❌ Editing module variables in a non-backward-compatible way (always add new vars with defaults)

---

## Reference Documentation

- `docs/infrastructure.md` — module list and pattern overview
- `docs/deployment.md` — full first-deploy walkthrough
- `docs/bootstrap.md` — one-time bootstrap setup
- `.claude/skills/cd-register-service/SKILL.md` — registering a new service
- `.claude/skills/infra-new-module/SKILL.md` — creating an entirely new module
- `.claude/skills/init-runner-deploy-task/SKILL.md` — adding a one-shot deploy task
- `.claude/skills/lambda-function-url/SKILL.md` — Lambda Function URL pattern
- `.claude/skills/add-notifications/SKILL.md` — new notification channel
- `.claude/skills/add-monitoring/SKILL.md` — new CloudWatch alarms
