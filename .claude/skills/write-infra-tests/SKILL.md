---
name: write-infra-tests
description: Validate Terraform modules and environment roots — `terraform fmt`, `terraform validate`, `tflint`, plan-against-noop, and module-level smoke tests. Use this before merging any infra change, when scaffolding a new module via `infra-new-module`, or when triaging a `cd-infra-plan.yml` PR comment failure.
---

# Validating Terraform Infrastructure Changes

Canonical references:
- `infra/modules/` — all reusable child modules
- `infra/environments/{dev,staging,prod,preview}/` — composed env roots
- `.github/workflows/cd-infra-plan.yml` — PR-time `terraform plan` runner

---

## What "Tests" Mean for Terraform Here

We do **not** use Terratest, Kitchen-Terraform, or any Go-based test harness — those are heavyweight for this template's scale. Instead, infra "tests" are a layered set of static and plan-time checks that every module and env root must pass before merge:

| Layer | Tool | What it catches |
|---|---|---|
| Formatting | `terraform fmt -check -recursive infra/` | Style drift |
| Syntax + types | `terraform validate` (per env root) | Bad references, type mismatches, unknown args |
| Best practices | `tflint --recursive` | Deprecated args, missing required tags, unused declarations |
| Drift / impact | `terraform plan -refresh=false` against current state | What this PR will actually change |
| Registry sync | `pnpm tsx scripts/lint-standards.ts` | Service-registry env-var drift, missing infra entries |
| CD smoke test | `cd-deploy.yml` post-deploy `GET /api/health` | Does the deployed Lambda actually respond |

---

## Required Pre-Merge Checks

Run these locally before opening / updating an infra PR. The `cd-infra-plan.yml` workflow runs an equivalent set for `dev`, `staging`, `prod` and posts the plan diff as a PR comment.

```powershell
# 1. Format check
terraform fmt -check -recursive infra/

# 2. Per-environment validate
foreach ($env in @('dev','staging','prod','preview')) {
  Push-Location "infra/environments/$env"
  terraform init -backend=false        # no remote state needed for validate
  terraform validate
  Pop-Location
}

# 3. tflint (install once: brew install tflint  /  scoop install tflint)
tflint --recursive --chdir infra

# 4. Registry-driven coding standards
pnpm tsx scripts/lint-standards.ts

# 5. Plan against current state (requires AWS creds for the target env)
Push-Location infra/environments/dev
terraform init                         # uses real backend
terraform plan -refresh=false -out=tfplan.bin
terraform show tfplan.bin              # human-readable diff
Pop-Location
```

---

## What to Inspect in a Plan

A plan diff is your unit test for infra. Read it with skepticism:

| Plan output | What it usually means | Action |
|---|---|---|
| `+ create` for a brand new module instance | Expected for new services | Confirm the resource name matches `service-registry.json` |
| `~ update in-place` on `aws_lambda_function` env vars | Routine — env var added / changed | OK |
| `-/+ replace` on `aws_dynamodb_table` | **DANGER** — table will be destroyed | Stop. Use a migration plan, not a replace |
| `-/+ replace` on `aws_db_instance` | **DANGER** — RDS will be destroyed | Stop. Snapshot first, plan a blue/green |
| `~ update in-place` on `aws_iam_role_policy` | Permissions change | Re-read the policy diff carefully |
| `- destroy` of any production resource | **STOP** — never destroy in prod via a feature PR | Use `cd-destroy.yml` only |

If the plan shows a destructive change you did not intend, **revert and ask before applying**.

---

## Module-Level Smoke Patterns

When adding a new module via `infra-new-module`, validate the module itself before wiring it into env roots:

```powershell
# Create a throwaway test root that consumes only your module
New-Item -ItemType Directory -Path infra/test-harness -Force
@"
terraform { required_version = ">= 1.6" }
provider "aws" { region = "eu-west-2" }
module "subject" {
  source = "../modules/{your-module}"
  # ... minimal required vars ...
}
"@ | Out-File infra/test-harness/main.tf -Encoding utf8

Push-Location infra/test-harness
terraform init -backend=false
terraform validate
Pop-Location

# Cleanup
Remove-Item -Recurse -Force infra/test-harness
```

This catches missing `outputs.tf`, undeclared variables, and provider mismatches without requiring an AWS account.

---

## CI Integration

`cd-infra-plan.yml` runs on PRs that touch `infra/**` or `.github/service-registry.json`. It:
1. Sets up AWS creds via OIDC for each environment.
2. Runs `terraform init` + `terraform plan -no-color` per env.
3. Posts the plan output as a PR comment (separate comment per env).
4. **Does not apply** — apply only happens on merge to `develop` (dev) / `main` (staging) via `cd-deploy.yml`, or via manual dispatch for prod.

If `cd-infra-plan.yml` fails:
- Read the failed step's plan output in the comment.
- Reproduce locally using the commands above.
- Common causes: missing `service-registry.json` field, undeclared variable in the env root, IAM permission mismatch in the deploy role.

---

## Architectural Rules

1. **Never apply destructive plans without a migration plan.** Replacements of `aws_dynamodb_table`, `aws_db_instance`, `aws_s3_bucket`, or `aws_secretsmanager_secret` require explicit user confirmation.
2. **Every new module must have `outputs.tf` declarations** for every value that env roots will consume.
3. **Every variable in `variables.tf` must have a `description` and a `type`.** Optional vars need a `default`.
4. **`terraform fmt` is mandatory.** PRs failing fmt are auto-rejected by `cd-infra-plan.yml`.
5. **Plans are reviewed, not just approved.** A green plan is not a free pass — read the diff.

---

## Skills That Compose With This One

| Task | Also read |
|---|---|
| Creating a new module | `infra-new-module` |
| Adding a service / table / queue | `cd-register-service` |
| Adding a one-shot init task | `init-runner-deploy-task` |
| Wiring CloudFront | `cloudfront-cdn` |
