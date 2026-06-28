# Bootstrap — One-Time Per-Account Setup

This directory creates the foundational AWS resources needed **once per AWS account** before any environment (dev, staging, prod, preview) can be deployed.

## What It Creates

| Resource | Purpose |
|---|---|
| S3 bucket (`{project}-tfstate` or `{project}-{env}-tfstate`) | Terraform remote state storage (versioned, encrypted) |
| DynamoDB table (`{project}-tflock` or `{project}-{env}-tflock`) | Terraform state locking (prevents concurrent apply) |
| GitHub OIDC provider | Allows GitHub Actions to authenticate to AWS without long-lived credentials |
| IAM deploy role (`{project}-deploy`) | Role assumed by GitHub Actions via OIDC — scoped to project resources |
| S3 bucket (`{project}-deploy-artifacts` or `{project}-{env}-deploy-artifacts`) | Lambda ZIP deployment artifacts (auto-expires after 90 days) |
| ECR repository (`{project}-webapp`) | Docker images for the Next.js webapp on ECS |
| ECR repository (`{project}-monitoring-webapp`) | Docker images for the internal monitoring dashboard |
| IAM deploy role (`{project}-monitoring-deploy`) | Role assumed by the monitoring CD workflow (separate from main deploy role) |

> **Multi-account note:** When the `environment` variable is set, globally-unique resource names (S3 buckets, DynamoDB table) are suffixed with the environment name (e.g., `acme-dev-tfstate`). Account-scoped names (ECR repo, IAM role) stay as-is since they can't collide across accounts.

## Prerequisites

1. **AWS CLI** configured with admin credentials for the target account.
2. **Terraform** >= 1.6.0 installed (`brew install terraform` or `choco install terraform`).
3. **GitHub CLI** (`gh`) authenticated — needed to set repository/environment variables.

## Credential Files

Bootstrap tasks use temporary AWS credential files stored in this directory. These are gitignored.

| File | Purpose |
|---|---|
| `aws-credentials` | Default credentials (single-account setup) |
| `aws-credentials.dev` | Credentials for the dev AWS account |
| `aws-credentials.staging` | Credentials for the staging AWS account |
| `aws-credentials.prod` | Credentials for the prod AWS account |

Copy `aws-credentials.example` and fill in your STS session token:

```bash
cp aws-credentials.example aws-credentials.dev
# Edit with your dev account credentials
```

Format:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

---

## Quick-Start Flow

### Single-Account

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  1. Copy credential file                                           │
 │     cp aws-credentials.example aws-credentials                     │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  2. Fill in temporary AWS credentials                              │
 │     AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN     │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  3. Create terraform.tfvars                                        │
 │     project_name, github_org, github_repo, aws_region              │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  4. Run VS Code task: AWS: Bootstrap Init  → select "default"      │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  5. Run VS Code task: AWS: Bootstrap Apply → select "default"      │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  6. Run VS Code task: AWS: Setup GitHub Repo Variables → select "default"│
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  7. git push origin develop  →  auto-deploys to dev ✓              │
 └─────────────────────────────────────────────────────────────────────┘
```

### Multi-Account (repeat for each environment)

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  1. Create credential files (one per AWS account)                  │
 │     cp aws-credentials.example aws-credentials.dev                 │
 │     cp aws-credentials.example aws-credentials.staging             │
 │     cp aws-credentials.example aws-credentials.prod                │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  2. Fill each file with that account's temporary credentials       │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  3. Create terraform.tfvars                                        │
 │     project_name, github_org, github_repo, aws_region              │
 └──────────────────────────────┬──────────────────────────────────────┘
                                ▼
 ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
 │  REPEAT FOR EACH ENV: dev → staging → prod                        │
 │                                                                    │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │  4. Run task: AWS: Bootstrap Init        → select env        │  │
 │  └─────────────────────────┬────────────────────────────────────┘  │
 │                            ▼                                       │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │  5. Run task: AWS: Bootstrap Apply       → select env        │  │
 │  └─────────────────────────┬────────────────────────────────────┘  │
 │                            ▼                                       │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │  6. Run task: AWS: Setup GitHub Env Vars → select env        │  │
 │  └─────────────────────────┬────────────────────────────────────┘  │
 └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                               ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  7. git push origin develop  →  auto-deploys to dev account ✓     │
 └─────────────────────────────────────────────────────────────────────┘
```

---

## Option A: Single-Account Setup

All environments (dev, staging, prod, preview) share one AWS account. Simplest to start.

### Step 1 — Create credential file

```bash
cp aws-credentials.example aws-credentials
```

Edit `aws-credentials` and fill in your temporary AWS credentials (STS session token or SSO):

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
AWS_SESSION_TOKEN=FwoGZX...
```

### Step 2 — Create `terraform.tfvars`

Create a `terraform.tfvars` file in this directory:

```hcl
project_name = "acme"
github_org   = "YourOrg"
github_repo  = "your-repo"
aws_region   = "eu-west-2"
```

### Step 3 — Bootstrap (VS Code tasks)

Run these VS Code tasks in order (Command Palette → **Tasks: Run Task**):

| Order | VS Code Task | What it does |
|---|---|---|
| 1 | **`AWS: Bootstrap Init`** → select `default` | Initializes Terraform backend |
| 2 | **`AWS: Bootstrap Apply`** → select `default` | Creates all AWS resources (S3, DynamoDB, IAM, ECR) |
| 3 | **`AWS: Setup GitHub Repo Variables`** → select `default` | Reads outputs → sets repo-level GitHub variables |

### Step 4 — Deploy

```bash
git push origin develop   # → auto-deploys to dev
git push origin main      # → auto-deploys to staging
```

---

## Option B: Multi-Account Setup (AWS Best Practice)

Each environment gets its own AWS account for isolation. Recommended for production workloads.

### Per-Account Steps (repeat for dev, staging, prod)

```
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
  │   Create     │    │   Create     │    │  Bootstrap   │    │  Bootstrap   │    │  Setup GitHub    │
  │  credential  │───▶│  terraform   │───▶│    Init      │───▶│    Apply     │───▶│  Env Variables   │
  │    file      │    │   .tfvars    │    │  → select env│    │  → select env│    │  → select env    │
  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────────┘
```

### Step 1 — Create credential files (one per account)

```bash
cp aws-credentials.example aws-credentials.dev
cp aws-credentials.example aws-credentials.staging
cp aws-credentials.example aws-credentials.prod
```

Edit each file with the **temporary credentials for that AWS account**:

```
# aws-credentials.dev
AWS_ACCESS_KEY_ID=AKIA...          ← dev account credentials
AWS_SECRET_ACCESS_KEY=wJalr...
AWS_SESSION_TOKEN=FwoGZX...
```

### Step 2 — Create `terraform.tfvars`

```hcl
project_name = "acme"
github_org   = "YourOrg"
github_repo  = "your-repo"
aws_region   = "eu-west-2"
# Note: `environment` is passed via the VS Code task prompt, not in tfvars
```

### Step 3 — Bootstrap DEV account

Run these VS Code tasks in order:

| Order | VS Code Task | Prompt selection |
|---|---|---|
| 1 | **`AWS: Bootstrap Init`** | Select **`dev`** |
| 2 | **`AWS: Bootstrap Apply`** | Select **`dev`** |
| 3 | **`AWS: Setup GitHub Environment Variables`** | Select **`dev`** |

This creates all AWS resources in the dev account and sets GitHub environment variables for `dev`.

### Step 4 — Bootstrap STAGING account

| Order | VS Code Task | Prompt selection |
|---|---|---|
| 1 | **`AWS: Bootstrap Init`** | Select **`staging`** |
| 2 | **`AWS: Bootstrap Apply`** | Select **`staging`** |
| 3 | **`AWS: Setup GitHub Environment Variables`** | Select **`staging`** |

### Step 5 — Bootstrap PROD account

| Order | VS Code Task | Prompt selection |
|---|---|---|
| 1 | **`AWS: Bootstrap Init`** | Select **`prod`** |
| 2 | **`AWS: Bootstrap Apply`** | Select **`prod`** |
| 3 | **`AWS: Setup GitHub Environment Variables`** | Select **`prod`** |

### Step 6 — Deploy

```bash
git push origin develop   # → auto-deploys to dev account
git push origin main      # → auto-deploys to staging account
# Manual dispatch for prod
```

### What the tasks do behind the scenes

```
  ┌─────────────────────────────┐          ┌──────────────────────────────────────┐
  │  AWS: Bootstrap Init        │          │  Result:                             │
  │  • Loads aws-credentials.{env}│────────▶│  Terraform state backend configured  │
  │  • Runs terraform init      │          │                                      │
  └─────────────────────────────┘          └──────────────────────────────────────┘

  ┌─────────────────────────────┐          ┌──────────────────────────────────────┐
  │  AWS: Bootstrap Apply       │          │  Result:                             │
  │  • Loads aws-credentials.{env}│────────▶│  AWS resources created:             │
  │  • Runs terraform apply     │          │  S3, DynamoDB, IAM Role, ECR         │
  └─────────────────────────────┘          └──────────────────────────────────────┘

  ┌────────────────────────────────┐       ┌──────────────────────────────────────┐
  │  AWS: Setup GitHub Env Vars    │       │  Result:                             │
  │  • Reads terraform outputs     │──────▶│  GitHub environment auto-created     │
  │  • Calls gh api to create env  │       │  6 environment variables set         │
  │  • Sets scoped variables       │       │                                      │
  └────────────────────────────────┘       └──────────────────────────────────────┘
```

### GitHub Variables (after setup)

| Variable | Scope | Set by |
|---|---|---|
| `PROJECT_NAME` | Repository (shared) | `AWS: Setup GitHub Environment Variables` |
| `AWS_ACCOUNT_ID` | Per environment | `AWS: Setup GitHub Environment Variables` |
| `AWS_REGION` | Per environment | `AWS: Setup GitHub Environment Variables` |
| `ARTIFACT_BUCKET` | Per environment | `AWS: Setup GitHub Environment Variables` |
| `ECR_REPO_URL` | Per environment | `AWS: Setup GitHub Environment Variables` |
| `TFSTATE_BUCKET` | Per environment | `AWS: Setup GitHub Environment Variables` |
| `TFSTATE_LOCK_TABLE` | Per environment | `AWS: Setup GitHub Environment Variables` |

---

## VS Code Tasks

All bootstrap operations have VS Code tasks (Command Palette → **Tasks: Run Task**):

| Task | Purpose |
|---|---|
| `AWS: Bootstrap Init` | `terraform init` with selected env credentials |
| `AWS: Bootstrap Plan` | `terraform plan` |
| `AWS: Bootstrap Apply` | `terraform apply` |
| `AWS: Setup GitHub Repo Variables` | Set repo-level variables (single-account) |
| `AWS: Setup GitHub Environment Variables` | Set env-scoped variables + auto-create GitHub environment (multi-account) |

Each task prompts for a credential environment (dev/staging/prod/default).

---

## Destroying Bootstrap Resources

> **WARNING:** Destroying bootstrap resources deletes ALL Terraform state for all environments. Only do this if you are decommissioning the entire project from an account.

```bash
# Remove prevent_destroy lifecycle from main.tf first, then:
terraform destroy \
  -var="project_name=acme" \
  -var="github_org=YourOrg" \
  -var="github_repo=your-repo"
```
