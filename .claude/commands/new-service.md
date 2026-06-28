---
description: "Add a new NestJS microservice to the workspace — HTTP API or SQS event handler. USE WHEN user says 'add a service', 'create a microservice', 'new API service', 'new NestJS service', 'new event handler service', or needs a new service app under apps/."
---

# New Service — Guided Workflow

You are orchestrating the creation of a new NestJS microservice in the Nx workspace. This covers both HTTP API services and SQS event-driven consumer services.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Domain** — which existing domain package will this service use? (e.g. `user-domain`, `order-domain`) Or is a new domain package needed first?
2. **Service type** — HTTP API service or SQS event-driven consumer?
3. **Service name** — follows the pattern `{domain}-api-service` or `{domain}-event-handler-service`
4. **Persistence** (HTTP API only) — DynamoDB OneTable or Prisma + PostgreSQL?
5. **Port number** (HTTP API only) — the `port-claim-checker` subagent in Phase 0.5 returns the next available port. Do NOT hardcode — use that output. Current registry (for context):
   - 3000 = user-api-service
   - 3001 = product-api-service
   - 3002 = order-api-service
   - 3003 = auth-api-service
   - 3004 = file-api-service
6. **SQS queue name** (event handler only) — follows `{domain}-events` convention
7. **Events to handle** (event handler only) — what event types and their payloads?

### Domain Package Check

If the user names a domain that doesn't have a domain package yet:

> "The `{domain}-domain` package doesn't exist yet. Would you like me to run the **New Domain** workflow first to create it?"

If yes → switch to the `/new-domain` workflow, then return here.

**Do not proceed until all applicable questions are answered.**

### Spec Summary (H6)

Before Phase 0.5, **echo the captured spec back** so the user can correct anything:

```
Domain:        {domain} (exists: yes/no)
Service:       {service}
Type:          {http-api / sqs-event-handler}
Persistence:   {dynamodb / prisma / n/a}
Port:          {tbd — from port-claim-checker} (HTTP only)
Queue:         {queue-name} (event handler only)
Events handled: {list} (event handler only)
```

Ask: "Is this correct? (yes / amend X)". Loop until confirmed.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: nx-microservice-scaffold, nestjs-service-layers, sqs-event-driven-service, gateway-jwt-auth, current-user-decorator, swagger-controller-docs")`
- `Agent(subagent_type="port-claim-checker", prompt="mode=next-port, newServiceName={service}")` — only if this is an HTTP API service. Skip for event-handler services.
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=all, thoroughness=quick")` — confirms the domain package is healthy before adding a new service to it.

Use the next-port output to populate `.env.local` and `service-registry.env` entries.

---

## Phase 1 — Nx Project Scaffold

**Load skill:** `.claude/skills/nx-microservice-scaffold/SKILL.md`

Create the Nx project files:
```
apps/{domain}/{service}/
  project.json
  tsconfig.json
  tsconfig.app.json
  jest.config.cts
  webpack.config.js (HTTP API) or webpack.config.js (event handler — skip @nestjs/swagger)
```

Register the path alias in `tsconfig.base.json`.

**Lambda packaging targets (M1 — mandatory):** Every backend service's `project.json` must include `prune-lockfile`, `copy-workspace-modules`, and `prune` targets. These are required for Lambda ZIP packaging — covered by `nx-microservice-scaffold` skill but easy to miss when copy-pasting from older services.

**For SQS event handlers:** Install `@aws-sdk/client-sqs` + `@types/aws-lambda` instead of `@nestjs/swagger`.

**Validation gate:** Confirm `pnpm exec nx show project {service}` succeeds.

---

## Phase 2 — Internal Service Layers

### HTTP API Service

**Load skill (pick one):**
- DynamoDB: `.claude/skills/nestjs-service-layers/SKILL.md`
- Prisma: `.claude/skills/prisma-service-wiring/SKILL.md`

Create:
```
src/
  main.ts
  app/app.module.ts (with health endpoint controller)
  application/services/{entity}-application.service.ts
  infrastructure/config/dynamodb.config.ts (or prisma.config.ts)
  modules/{domain}.module.ts
  presentation/
    controllers/{entity}.controller.ts
    decorators/current-user.decorator.ts          (H2 — mandatory per Golden Rule #45)
    types/express.d.ts                            (H2 — typed request.user augmentation)
    pipes/zod-validation.pipe.ts
    filters/domain-exception.filter.ts
```

**(H1 — mandatory) Health endpoint:** Add `AppController` with `@Get('health')` + `@Public()` returning `{ status: 'ok', service: '{service}' }`. The method MUST be named `health()`. Never use `@Get()` (root) — it conflicts with the global API prefix and returns 404. The CD smoke test only accepts HTTP 200 from `/api/health` (Golden Rule #43).

**(H7) Application service singleton logger:** Declare `const logger = createLogger('{service}')` from `@mma/telemetry` at module top — mandatory and lint-checked (Golden Rule #35 / `app-service-has-logger`). Never use `new Logger()` from `@nestjs/common`.

**(M2) Prisma additional steps:**
- Import `SecretsConfig` from `@mma/aws-secrets` in `main.ts` Lambda handler and call `await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` before NestJS bootstrap.
- Add Prisma engine binary + `schema.prisma` to webpack `assets` array.
- Add `cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/` to the `Package init-runner` step in `.github/workflows/cd-deploy.yml` and `cd-preview-create.yml`.
- Add `prisma-migrate` entry to `deployTasks[]` in `service-registry.json`.

Also load:
- `.claude/skills/add-api-endpoints/SKILL.md` — for controller routes
- `.claude/skills/swagger-controller-docs/SKILL.md` — for Swagger annotations
- `.claude/skills/domain-exception-filter/SKILL.md` — for exception mapping
- `.claude/skills/current-user-decorator/SKILL.md` (H7 — mandatory; ship the per-service decorator file)
- `.claude/skills/gateway-jwt-auth/SKILL.md` (M3 — declare any `@Public()` routes in `service-registry.json` → `gatewayAuth.publicRoutes`; the `gateway-public-routes-sync` lint check requires both sides to match)

### SQS Event-Driven Service

**Load skill:** `.claude/skills/sqs-event-driven-service/SKILL.md`

Create:
```
src/
  main.ts (no HTTP, no Swagger — STAGE=local branching)
  app/app.module.ts
  application/
    interfaces/normalized-sqs-record.interface.ts
    services/{domain}-event-handler.service.ts
  infrastructure/
    config/
    sqs/sqs-local.service.ts
  modules/{domain}.module.ts
```

No `presentation/` folder — SQS services have no controllers.

**Validation gate:** Run `Bash` on the service directory. Fix all errors.

---

## Phase 3 — Infrastructure & Environment

**Load skill:** `.claude/skills/generate-env-local/SKILL.md`

### HTTP API Service

- [ ] Add `{DOMAIN}_SERVICE_PORT={port}` to `.env.local`
- [ ] Add `API_{DOMAIN}_URL=http://localhost:{port}/api` to `.env.local`
- [ ] Add `NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{port}/api` to `.env.local`
- [ ] **DynamoDB:** Add `{DOMAIN}_DYNAMODB_TABLE_NAME=OldSTTable` to `.env.local`; add table config to `scripts/setup-localstack.ts`
- [ ] **Prisma:** Add `{DOMAIN}_DATABASE_URL` to `.env.local`; ensure Postgres in `docker-compose.yml`; register in `scripts/prisma-migrate-all.ts`; add `ignoreWarnings` in `webpack.config.js`
- [ ] Update `.env.local.example`

### SQS Event-Driven Service

- [ ] Add `{DOMAIN}_SQS_QUEUE_URL=http://sqs.{region}.localhost.localstack.cloud:4566/000000000000/{queue-name}` to `.env.local`
- [ ] Add `{DOMAIN}_SQS_QUEUE_NAME={queue-name}` to `.env.local`
- [ ] Add queue to `QUEUE_CONFIGS` in `scripts/setup-localstack.ts`
- [ ] Update `.env.local.example`

### Both Service Types — VS Code tasks

- [ ] Add `Service: Serve {service}` task to `.vscode/tasks.json`
- [ ] Append to `Services: Start All` `dependsOn` array
- [ ] Add or update `Domain: Start {Domain}` compound task

---

## Phase 4 — CD Registration (H3 — mandatory)

**Load skill:** `.claude/skills/cd-register-service/SKILL.md`

Without this phase the service builds locally but is invisible to the CD pipeline — no Lambda function, no API Gateway route, no SQS event source mapping is created.

### `.github/service-registry.json`

- [ ] Add an entry to `apiServices[]` (HTTP) or `eventHandlerServices[]` (SQS) with: `name` (Nx project name), `distPath`, `domain`, `type`, `handler`, `memorySize`, `timeout`, `envVars[]` (whitelist).
- [ ] Set `requiresVpc: true` if the service needs RDS/VPC access.
- [ ] HTTP API: register every `@Public()` route in `gatewayAuth.publicRoutes[]` (must match `@Public()` decorators — `gateway-public-routes-sync` lint check enforces this).
- [ ] SQS: set `sqsQueueRef` to the queue's logical name in `infrastructure.sqsQueues[]`.
- [ ] Add infrastructure entries to `infrastructure.dynamodbTables[]` / `infrastructure.sqsQueues[]` / `infrastructure.rds[]` as needed.

### `.github/service-registry.env`

- [ ] Add per-service env vars (the `service-registry-env-sync` lint check verifies every SQS/DynamoDB/database env var declared in module code appears in BOTH registry files).

### CI workflow updates (Prisma only)

- [ ] Add `postgres` service container to `services:` block in `ci-e2e.yml` and `ci-test-all.yml`.
- [ ] Add `{DOMAIN}_DATABASE_URL` to `env:` of the `test-affected` job in `ci-test-affected.yml`.
- [ ] Add `pnpm prisma:{domain}:generate` step (after `Install dependencies`) to `ci-test-all.yml`, `ci-fast-check.yml`, and `ci-test-affected.yml`.

### Webapp NEXT_PUBLIC_* (HTTP API only)

- [ ] If this service introduces a new `NEXT_PUBLIC_API_{DOMAIN}_URL`, add it to `service-registry.json` → `webapp.envVars` AND to `apps/webapp/Dockerfile` `ARG`/`ENV` block.

---

## Phase 5 — Tests (H4 — mandatory)

**Load skill:** `.claude/skills/write-domain-tests/SKILL.md`

A new service ALWAYS gets at least:
- [ ] `{entity}-application.service.spec.ts` — covers the public methods, DTO transformation, cursor routing (DynamoDB), event publishing if applicable.
- [ ] (HTTP API) Health endpoint controller spec — trivial but documents the contract.
- [ ] (SQS event handler) Dispatcher spec — event type routing + each handler function (delegation, idempotency).

**Validation gate (mandatory):**

```bash
pnpm exec nx test {service} --skip-nx-cache --coverage
```

Must hit 70% coverage threshold. If it fails, add tests — do not move to the next phase.

---

## Phase 5b — API E2E project (H5 — mandatory for HTTP API services)

**Skip for SQS event handlers.**

**Load skills:** `.claude/skills/write-api-e2e-tests/SKILL.md` then `.claude/skills/e2e-infrastructure/SKILL.md`

A new HTTP API service ALWAYS gets a paired `-e2e` project (mirrors `/new-domain` Phase 9b):

- [ ] Create `apps/{domain}/{service}-e2e/` following `write-api-e2e-tests`.
- [ ] Update `scripts/setup-e2e.ts` and `scripts/teardown-e2e.ts` per `e2e-infrastructure`.
- [ ] Set `"passWithNoTests": false` in `apps/{domain}/{service}-e2e/project.json` (otherwise CI silently passes with zero specs).
- [ ] Add at least one health-endpoint spec + one happy-path CRUD spec.
- [ ] Run `pnpm exec nx e2e {service}-e2e` once locally to confirm it passes.

---

## Phase X — Post-Validate (parallel subagents)

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/{service}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{service}, ruleSet=http-service")` — or `ruleSet=event-handler` for SQS consumers.
- `Agent(subagent_type="port-claim-checker", prompt="mode=audit")`

Fix any reported issues before final verification.

---

## Final Verification

```bash
pnpm exec nx test {service} --skip-nx-cache --coverage
pnpm exec nx build {service} --skip-nx-cache
```

For HTTP API services, also run the E2E suite and verify it starts:
```bash
pnpm exec nx e2e {service}-e2e
pnpm exec nx serve {service}        # then curl http://localhost:{PORT}/api/health
```

Confirm:
- [ ] Service builds cleanly.
- [ ] Coverage threshold met (70%).
- [ ] E2E spec passes (HTTP API only).
- [ ] `GET /api/health` returns `{ status: 'ok', service: '{service}' }` (HTTP API only).
- [ ] Service appears in `.github/service-registry.json` and `.github/service-registry.env`.
- [ ] Lint check passes: `pnpm exec ts-node --project scripts/tsconfig.json scripts/lint-standards.ts`.

**Summary:** Report what was created — project files, service structure, env vars, tasks, registry entries, E2E project, and any manual steps remaining.
