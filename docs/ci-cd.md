# CI/CD Testing Strategy

This repository uses GitHub Actions with smart test execution based on what changed.

## 🚀 Workflows Overview

### 1. **Fast PR Check** (`ci-fast-check.yml`) ⭐ RECOMMENDED
**Trigger:** Every pull request  
**Speed:** ~30 seconds  
**What it does:**
- ✅ Tests only affected projects (using Nx)
- ✅ Unit tests only (no database)
- ✅ Lint and type check
- ✅ Build verification

```yaml
# Only tests what you changed
pull_request → Nx detects changes → Tests affected services only
```

### 2. **Affected Services** (`ci-test-affected.yml`)
**Trigger:** Pull requests  
**Speed:** Varies by changes  
**What it does:**
- ✅ Detects all affected projects
- ✅ Runs separate jobs per domain
- ✅ Parallel execution
- ✅ Full test coverage for changed code

### 3. **Test All** (`ci-test-all.yml`)
**Trigger:** Push to main/develop  
**Speed:** ~5 minutes  
**What it does:**
- ✅ Complete test suite
- ✅ All domains + all services
- ✅ Unit + integration + E2E

### 4. **E2E Tests** (`ci-e2e.yml`)
**Trigger:** Pull requests + push to main/develop/release/**  
**Speed:** ~10 minutes  
**What it does:**
- ✅ Builds and starts all backend services
- ✅ Runs API E2E tests (Jest + axios) against real endpoints
- ✅ Builds and starts the webapp
- ✅ Runs Playwright browser E2E tests
- ✅ Uses dedicated E2E infrastructure (separate tables, databases, queues)
- ✅ Uploads Playwright reports + test artifacts on failure

```yaml
# Two sequential jobs:
api-e2e-tests → webapp-e2e-tests (runs only if API E2E passes)
```

### 5. **CD: Deploy** (`cd-deploy.yml`)
**Trigger:** Push to `develop` → dev, push to `main` → staging, manual dispatch (any env)  
**Speed:** ~5–15 minutes (Terraform apply + Lambda + webapp deploys)  
**What it does:**
- ✅ Reads `service-registry.json` to determine what to build
- ✅ `terraform apply` — creates/updates all AWS resources for the target environment
- ✅ ECS init-runner — runs Prisma migrations, DynamoDB seeds, custom scripts
- ✅ Builds affected Lambda ZIPs and pushes to S3 artifact bucket
- ✅ Updates each Lambda function's code from the new artifact
- ✅ Builds the webapp Docker image, pushes to ECR
- ✅ Either `aws ecs update-service` (ECS mode) or `aws lambda update-function-code --image-uri` (Lambda mode), based on `webapp.deploymentMode`
- ✅ Smoke tests the `/api/health` endpoint of every API service before reporting success

### 6. **CD: Monitoring Deploy** (`cd-monitoring-deploy.yml`)
**Trigger:** Manual dispatch only (per environment)  
**Speed:** ~5 minutes  
**What it does:**
- ✅ Builds + deploys the internal monitoring tool (`monitoring-api-service` + `monitoring-webapp` Lambda container images)
- ✅ Applies `infra/environments/{env}/monitoring/` Terraform (adds the monitoring Lambdas + Function URLs)
- ✅ Updates the `MONITORING_API_URL` GitHub variable from the Terraform output

### 7. **CD: Preview Create / Destroy** (`cd-preview-create.yml` + `cd-preview-destroy.yml`)
**Trigger:** Manual dispatch  
**What it does:**
- ✅ Creates / destroys an isolated full-stack preview environment from any branch
- ✅ Each preview has its own state file: `s3://{bucket}/preview/{name}/terraform.tfstate`
- ✅ Reduced resource sizing (Lambda 256MB, RDS db.t4g.micro)

### 8. **CD: Destroy** (`cd-destroy.yml`)
**Trigger:** Manual dispatch with double confirmation  
**What it does:**
- ✅ Permanently destroys an entire dev/staging/prod environment
- ✅ Requires typing the environment name + the word `DESTROY` to proceed

### 9. **CD: Infra Plan** (`cd-infra-plan.yml`)
**Trigger:** PR with changes to `infra/**` or `service-registry.json`  
**What it does:**
- ✅ Runs `terraform plan` for dev, staging, prod
- ✅ Posts the plan as a PR comment so reviewers see the exact AWS changes before merge

---

## 📊 Test Execution Strategy

### Unit Tests (Fast - No DB)
```bash
# GitHub Actions
pnpm nx affected --target=test --parallel=3

# What it does:
# - Detects changed projects using Git diff
# - Runs only affected unit tests
# - Excludes integration tests
# - No DynamoDB needed
# - Fast feedback (< 1 min)
```

### Integration Tests (Slower - With DB)

Integration tests use **LocalStack** for DynamoDB + SQS and **Docker Postgres** for Prisma domains. Tests run via standard Nx commands — no separate integration script exists.

```bash
# Run integration tests for a specific domain
pnpm nx test user-domain --skip-nx-cache

# Run all domain tests (unit + integration together)
pnpm nx run-many --target=test --projects=*-domain
```

All domains share the same LocalStack service container in CI. Postgres container is also provided for Prisma-backed domains. See `.github/workflows/ci-e2e.yml` for the full service container configuration.

---

## 🎯 Workflow Selection Guide

| Scenario | Workflow | Speed | Coverage |
|----------|----------|-------|----------|
| **Quick PR check** | `ci-fast-check.yml` | ⚡ Fast | Affected only |
| **Changed any domain code** | `ci-test-affected.yml` | ⚡⚡ Medium | Affected domain(s) |
| **Merge to main** | `ci-test-all.yml` | 🐌 Slow | Everything |
| **Release** | `ci-test-all.yml` | 🐌 Slow | Everything |
| **E2E validation** | `ci-e2e.yml` | 🐌 Slow | Full API + browser E2E |

---

## 🔍 How Nx "Affected" Works

```bash
# Example: You changed user-domain entity
git diff main...HEAD

# Nx detects:
✅ user-domain (directly changed)
✅ user-api-service (depends on user-domain)
❌ order-domain (not affected)
❌ product-domain (not affected)

# GitHub Actions runs:
pnpm nx affected --target=test
# → Tests ONLY user-domain + user-api-service
# → Skips order-domain + product-domain
# → Saves time and compute resources
```

---

## 💾 Database Setup in CI/CD

### Single Shared LocalStack Container

```yaml
services:
  localstack:
    image: localstack/localstack
    ports:
      - 4566:4566
    env:
      SERVICES: dynamodb
      DYNAMODB_SHARE_DB: 1
```

**All integration tests use the same container.** There is a single DynamoDB table (`OldSTTable` by default — set via `{DOMAIN}_DYNAMODB_TABLE_NAME` env vars) using OneTable's single-table design. Domains are isolated by model type prefixes within the same table, not by separate table names. Prisma-backed domains (e.g. `order-domain`) use a dedicated Postgres container instead.

---

## 📝 Example: Affected-Only Test Run

### Scenario
You changed `packages/{domain}-domain/src/domain/entities/{entity}.entity.ts`

### What Happens

**1. Fast Check (30 seconds)**
```bash
✅ Lint {domain}-domain
✅ Test {domain}-domain (unit)
✅ Test {domain}-api-service (unit)
✅ Build {domain}-api-service
```

**2. Integration Check (if fast check passes)**
```bash
✅ Start LocalStack
✅ Test {domain}-domain (integration)
✅ Test {domain}-api-service (E2E)
```

**3. Other Services**
```bash
⏭️  Skipped (not affected)
```

---

## 🚦 Branch Protection Rules

Configure these checks as **required** on both `main` and `develop`. See `docs/coding-standards.md` §15 for the full one-time setup walkthrough.

| Workflow | Job name | What it enforces |
|---|---|---|
| `ci-test-affected.yml` | `Test Affected (Unit + Integration)` | Unit tests + coverage thresholds for all affected projects |
| `ci-e2e.yml` | `API E2E Tests` | Backend API E2E (skipped for frontend-only PRs) |
| `ci-e2e.yml` | `Webapp E2E Tests (Playwright)` | Playwright E2E (skipped for backend-only PRs) |
| `ci-fast-check.yml` | `Quick Validation (Affected Only)` | Lint + build pass |

> **Note on skipped jobs:** GitHub treats a skipped required check as passing — this is correct. A frontend-only PR will skip `API E2E Tests` without blocking merge.

---

## ⚡ Optimization Tips

### 1. Cache Dependencies
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'pnpm'  # ← Caches node_modules
```

### 2. Parallel Execution
```bash
# Run 3 test suites simultaneously
pnpm nx affected --target=test --parallel=3
```

### 3. Separate Fast/Slow Tests
```yaml
# Job 1: Unit tests (fast)
test-unit:
  run: pnpm test:unit

# Job 2: Integration tests (slow) - only if unit passes
test-integration:
  needs: test-unit
  run: pnpm test:integration
```

### 4. Skip Integration Tests When Not Needed
```bash
# If only documentation changed, skip tests
paths-ignore:
  - '**.md'
  - 'docs/**'
```

---

## 📈 Typical Execution Times

| Test Type | Projects | Time | Database |
|-----------|----------|------|----------|
| **Unit (all)** | All domains | 2 min | ❌ No |
| **Unit (affected)** | 1-2 domains | 30 sec | ❌ No |
| **Integration (all)** | All domains | 5 min | ✅ Yes |
| **Integration (affected)** | 1 domain | 1 min | ✅ Yes |
| **E2E (all)** | All services | 8 min | ✅ Yes |
| **E2E (affected)** | 1 service | 2 min | ✅ Yes |

---

## 🎯 Real-World Example

### PR: Add email validation to User entity

**Files changed:**
```
packages/{domain}-domain/src/domain/entities/{entity}.entity.ts
packages/{domain}-domain/src/domain/entities/{entity}.entity.spec.ts
```

**CI/CD execution:**

1. **Detect affected** → `{domain}-domain`, `{domain}-api-service`
2. **Lint** → user-domain (5 sec)
3. **Unit tests** → user-domain (10 sec)
4. **Build** → user-api-service (15 sec)
5. **Integration tests** → user-domain (30 sec)

**Total:** ~60 seconds ⚡

**Skipped:**
- ⏭️ order-domain tests
- ⏭️ product-domain tests
- ⏭️ orders-api-service tests

**Time saved:** ~4 minutes per PR (if testing everything)

---

## 🔧 Manual Triggers

### Test Specific Service
```bash
# Trigger affected tests manually
gh workflow run ci-test-affected.yml
```

### Test Everything
```bash
# Trigger full test suite
gh workflow run ci-test-all.yml
```

---

## 🐛 Troubleshooting

### `nx-set-shas` — "Resource not accessible by integration"
`nrwl/nx-set-shas@v4` calls the GitHub Actions REST API to find the last successful workflow run. This requires `actions: read` permission, which is **not** granted by default when a repository has restrictive token settings.

Every workflow that uses `nrwl/nx-set-shas@v4` must declare a top-level `permissions` block:

```yaml
permissions:
  actions: read   # required by nrwl/nx-set-shas@v4
  contents: read  # required by actions/checkout
```

This is already present in `ci-fast-check.yml`, `ci-test-affected.yml`, and `ci-test-all.yml`. If you create a new workflow that uses `nx-set-shas`, add this block immediately after the `on:` trigger.

---

### LocalStack Service Not Ready
```yaml
services:
  localstack:
    options: >-
      --health-cmd "curl -f http://localhost:4566/_localstack/health || exit 1"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 10
      --health-start-period 15s
```

### Tests Fail Due to Missing Dependencies
```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
  # Use frozen-lockfile to ensure exact versions
```

### Nx Cache Issues
```yaml
- name: Clear Nx cache
  run: pnpm nx reset
```

### Playwright Browser Install Fails
```yaml
# ci-e2e.yml caches Playwright browsers via actions/cache
# If cache miss, runs: npx playwright install --with-deps chromium
# If cache hit, only installs system deps: npx playwright install-deps chromium
```

### E2E Tests Fail: Services Not Ready
```bash
# CI uses test/e2e/wait-for-services.ts to poll service health
# Locally, ensure all services are running before running E2E:
pnpm run e2e:setup   # Create E2E infrastructure
# Start services via VS Code task "Dev: Start All"
pnpm nx e2e webapp-e2e
```

---

## 📚 Summary

✅ **Smart testing** - Only test what changed  
✅ **Fast feedback** - Unit tests in < 1 min  
✅ **Shared database** - One DynamoDB for all domains  
✅ **Parallel execution** - Multiple test suites at once  
✅ **Fail fast** - Unit tests before integration tests  
✅ **E2E coverage** - API + Playwright browser tests validate full vertical slices  
✅ **Data isolation** - E2E uses dedicated tables, databases, and queues  

**Result:** Faster CI/CD, lower costs, happier developers! 🚀
