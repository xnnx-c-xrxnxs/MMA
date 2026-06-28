# Getting Started

Get the template running locally in under 10 minutes. No AWS account or cloud database needed.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | `24.x` (Active LTS) | Use `nvm` — a `.nvmrc` at the repo root pins the version |
| **pnpm** | `>=9.0.0` | Workspace package manager |
| **Docker Desktop** | latest | Runs LocalStack and PostgreSQL locally |
| **nvm** | latest | For automatic Node version management |

### Install nvm

**macOS / Linux:**

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

**Windows:** Use [nvm-windows](https://github.com/coreybutler/nvm-windows/releases).

### Install Node.js 24 and pnpm

```sh
nvm install 24
nvm use          # reads .nvmrc automatically
npm install -g pnpm
```

> All VS Code tasks call `scripts/ensure-node.js` which auto-selects the correct Node version. You only need it **installed** via `nvm install 24` — manual `nvm use` before each task is not required.

---

## 1. Clone and Install

```sh
git clone <repository-url>
cd mma
nvm use
pnpm install
```

## 2. Create `.env.local`

```sh
cp .env.local.example .env.local
```

`.env.local` is gitignored. `.env.local.example` is the committed source of truth — keep it in sync when adding services.

If `.env.local` is missing variables after a new service was added, ask Claude Code to *"generate-env-local"* — it scans the codebase and outputs all missing entries.

## 3. Start Local Infrastructure

```sh
# Start LocalStack + Postgres
docker compose up -d

# Create DynamoDB tables + SQS queues on LocalStack
pnpm run localstack:setup

# Apply Prisma migrations for all Prisma-based domains
pnpm run prisma:migrate:all
```

To wipe everything and start fresh:

```sh
docker compose down -v
```

## 4. Run the Services

The fastest path is the VS Code task **`Dev: Start All`** (Command Palette → **Tasks: Run Task**). It runs infra setup then starts every service in parallel.

Other useful compound tasks:

| Task | What it does |
|---|---|
| `Infra: Start All` | Node check → Docker → LocalStack setup → Prisma migrations |
| `Domain: Start User` | Infra → user-api-service + user-event-handler-service |
| `Domain: Start Product` | Infra → product-api-service + product-event-handler-service |
| `Domain: Start Order` | Infra → order-api-service + order-event-handler-service |
| `Domain: Start Auth` | Infra → auth-api-service |
| `Domain: Start Files` | Infra → file-api-service |
| `Services: Start All` | All services in parallel (assumes infra is up) |
| `Monitoring: Start All` | monitoring-api-service + monitoring-webapp |

### Service URLs

| Service | Base URL | Swagger | Persistence |
|---|---|---|---|
| `user-api-service` | `http://localhost:3000/api` | `/api/docs` | DynamoDB |
| `product-api-service` | `http://localhost:3001/api` | `/api/docs` | DynamoDB |
| `order-api-service` | `http://localhost:3002/api` | `/api/docs` | PostgreSQL (Prisma) |
| `auth-api-service` | `http://localhost:3003/api` | `/api/docs` | Cognito / LocalAuth |
| `file-api-service` | `http://localhost:3004/api` | `/api/docs` | S3 (presigned URLs) |
| `monitoring-api-service` | `http://localhost:8080/api` | `/api/docs` | CloudWatch / OTel |
| `monitoring-webapp` | `http://localhost:4300` | — | (consumes monitoring-api) |
| `webapp` | `http://localhost:4200` | — | (consumes the APIs above) |

> **Local auth:** `auth-api-service` uses `LocalAuthProvider` when `STAGE=local`. Sign in with `admin@test.com` / `Password123!` — no Cognito setup required.

## 5. Run Tests

```sh
# All tests
pnpm test

# Affected only (uses Nx affected detection)
pnpm nx affected --target=test

# Single project
pnpm nx test user-domain
```

For E2E tests, see [testing.md](testing.md#e2e-testing).

## Project Structure (Quick Reference)

```
apps/
  users/            ← user-api-service + user-event-handler-service + e2e
  products/         ← product-api-service + product-event-handler-service + e2e
  orders/           ← order-api-service + order-event-handler-service + e2e
  auth/             ← auth-api-service + e2e
  files/            ← file-api-service
  monitoring/       ← monitoring-api-service + monitoring-webapp
  webapp/           ← Next.js App Router frontend
  webapp-e2e/       ← Playwright E2E
  mobile/           ← Expo (React Native)

packages/
  user-domain/      ← User bounded context
  product-domain/   ← Product bounded context
  order-domain/     ← Order bounded context
  contracts/        ← Per-domain Zod schemas + types (subpath imports)
  client-common/    ← API clients + React Query hooks (shared by webapp + mobile)
  ui/               ← Web UI primitives
  mobile-ui/        ← Mobile UI primitives
  telemetry/        ← Logger, OTel tracer, correlationId middleware
  monitoring-sdk/   ← Lambda/X-Ray providers for monitoring-api-service
  aws/              ← aws-sqs, aws-cognito, aws-secrets, aws-s3
  dynamodb-onetable/← OneTable client + table factory
  common/           ← Shared interfaces (pagination, etc.)
  eslint-plugin/    ← Custom ESLint rules
```

## Next Steps

- [Architecture overview](architecture.md)
- [Testing strategy](testing.md)
- [Deployment to AWS](deployment.md)
