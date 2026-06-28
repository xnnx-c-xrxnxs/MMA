# Engineering Handbook — Full-Stack Clean Architecture (Nx Monorepo)

> **This is the full reference manual.** The always-on rules an agent must never violate
> (the 47 Golden Rules, agent operating policies, coverage thresholds, ADR policy) live in
> the root [CLAUDE.md](../CLAUDE.md) — that is the authoritative, always-loaded contract.
> This handbook holds the deep reference detail: directory layout, step-by-step checklists,
> persistence / API / exception / environment / CD sections, and the skill + workflow
> catalogs. For single-layer patterns, the relevant `.claude/skills/<name>/SKILL.md` is the
> authoritative source — this handbook orients; skills implement.
>
> Covers the **backend** (NestJS microservices, domain packages, infrastructure), the
> **frontend** (Next.js webapp, shared UI library, data-access hooks), and the **deployment
> pipeline** (Terraform modules, CD workflows, preview environments).
>
> **If anything here conflicts with the current implementation, fix the implementation or
> update this file — but the Golden Rules in CLAUDE.md win.**

---

## 1. Baseline Architecture (What We Actually Use)

### Clean Architecture: Layers and Dependencies

```
Presentation (NestJS controllers, pipes, filters)
  -> Application Services (service orchestration)
    -> Use Cases (domain operations)
      -> Domain Entities (business rules)
        -> Infrastructure (repositories + DynamoDB OneTable or Prisma)
```

**Dependency rule:** inner layers never depend on outer layers. Infrastructure depends inward only via repository interfaces.

**Persistence:** The workspace supports two persistence strategies:

- **DynamoDB OneTable** — used by `user-domain`, `product-domain`. Cursor-based pagination.
- **Prisma + PostgreSQL** — used by `order-domain`. Offset-based pagination.

The domain and application layers are persistence-agnostic. Only the infrastructure layer knows which database is in use.

### Current Service + Package Layout

```
apps/
  users/
    user-api-service/           ← HTTP API service
      src/
        app/
        application/
          services/
        infrastructure/
          config/
          clients/              ← ACL adapters for cross-service HTTP calls (optional)
        modules/
        presentation/
          controllers/
          pipes/
          filters/

  {domain}/
    {domain}-event-handler-service/   ← SQS event-driven service (no HTTP)
      src/
        app/
        application/
          interfaces/             ← NormalizedSqsRecord (type boundary)
          services/
        infrastructure/
          config/
          sqs/                    ← SqsLocalService (AWS SDK client)
        modules/

packages/
  user-domain/
    src/
      domain/
        entities/
        constants/
        exceptions/
      application/
        use-cases/
        interfaces/
        exceptions/
      infrastructure/
        repositories/
        schemas/                ← DynamoDB OneTable schema

  order-domain/
    src/
      domain/
        entities/
        constants/
        exceptions/
      application/
        use-cases/
        interfaces/
        exceptions/
      infrastructure/
        repositories/
        prisma/                 ← Prisma schema file
        generated/              ← Generated Prisma client (gitignored)
          client/

  contracts/
    common/
      package.json
      project.json
      tsconfig.json
      src/
        index.ts
        pagination.ts
    user/
      package.json          ← depends on @mma/{domain}-domain + zod
      project.json          ← tags: ["scope:{domain}", "type:contracts"]
      tsconfig.json
      src/
        index.ts            ← domain barrel (import: @mma/contracts/{domain})
        schemas.ts
        event-schemas.ts
    order/
      package.json
      project.json
      tsconfig.json
      src/
        index.ts            ← domain barrel
        schemas.ts
        event-schemas.ts
    product/
      package.json
      project.json
      tsconfig.json
      src/
        index.ts            ← domain barrel
        schemas.ts
    auth/
      package.json
      project.json
      tsconfig.json
      src/
        index.ts            ← domain barrel (import: @mma/contracts/auth)
        schemas.ts          ← sign-in, refresh, password flows, discriminated unions

  common/
    src/
      interfaces/
        pagination.interface.ts

  dynamodb-onetable/
    src/
      client.ts
      table.ts
      utils/

  ui/
    src/
      components/             ← shadcn-style primitives (Badge, Button, Card, Table, etc.)
      lib/utils.ts              ← cn() helper (clsx + tailwind-merge)

  mobile-ui/
    src/
      components/             ← React Native primitives (Badge, Button, Card, Text, Input, Separator)
      lib/theme.ts              ← design tokens (colors, spacing, radii, fontSizes)

  client-common/
    src/
      infrastructure/
        config.ts               ← configureApi() — framework-agnostic URL configuration
        api-clients/            ← fetch-based API clients with Zod response parsing
        errors/api-error.ts     ← typed ApiError matching backend error shape
      hooks/                    ← React Query hooks (one file per domain)
      lib/
        query-client.ts         ← shared QueryClient config (staleTime, retry)
        providers.tsx            ← QueryClientProvider + configureApi bootstrap

  aws/
    aws-secrets/
      src/
        secrets-config.ts          ← SecretsConfig.resolve() — Lambda cold-start secret hydration
        index.ts
    aws-cognito/
      src/
        auth-provider.interface.ts   ← IAuthProvider abstract class
        cognito-auth-provider.ts     ← AWS Cognito SDK implementation
        local-auth-provider.ts       ← Local dev mock (admin@test.com/Password123!)
        index.ts
    aws-sqs/
      src/
        sqs-client-factory.ts
        sqs-standard-event-publisher.ts
        sqs-fifo-event-publisher.ts
        index.ts
    aws-s3/
      src/
        s3-client-factory.ts
        s3-file-storage.ts           ← S3FileStorage — presigned PUT/GET URL generation
        index.ts

  eslint-plugin/                    ← Custom ESLint rules (no-node-env-development)

  telemetry/
    src/
      tracer.ts                  ← initTelemetry(serviceName) — OTel SDK bootstrap (no-op when OTEL_SDK_DISABLED=true)
      logger.ts                  ← createLogger(serviceName): StructuredLogger — JSON to stdout with traceId/spanId/correlationId
      correlation.ts             ← correlationMiddleware(), runWithCorrelationId(), getCorrelationId(), getCorrelationHeaders() — AsyncLocalStorage-based request-scoped ID propagation
      sqs-propagation.ts         ← injectTraceContext / extractTraceContext for SQS MessageAttributes
      index.ts

apps/
  webapp/                         ← Next.js App Router frontend
    src/
      app/                        ← routes (page.tsx per segment)
        layout.tsx                ← root shell: Providers + content
        auth/                     ← public auth pages (login, forgot-password, new-password)
        (protected)/              ← auth-gated route group
          layout.tsx              ← redirects to /auth/login if not authenticated
          users/
          products/
          orders/
      components/                 ← domain-scoped UI components
        users/
        products/
        orders/
        layout/                   ← Header, Sidebar
      lib/
        status-variants.ts        ← badge variant mapping per entity status

  auth/
    auth-api-service/               ← Authentication API service (Cognito/local provider)
      src/
        app/
        application/
          services/                 ← AuthApplicationService
        modules/
        presentation/
          controllers/              ← AuthController (sign-in, refresh, password flows)
          pipes/
          filters/                  ← AuthExceptionFilter
          guards/                   ← JwtAuthGuard + @Public() decorator
          decorators/

  files/
    file-api-service/               ← File upload/download service (S3 presigned URLs)
      src/
        app/
        application/
          services/                 ← FileApplicationService (delegates to S3FileStorage)
        infrastructure/
          config/
          s3/                       ← S3FileStorage instance
        modules/
        presentation/
          controllers/              ← FileController (presigned-upload, presigned-download)

  monitoring/
    monitoring-api-service/         ← Internal monitoring API — OTel traces, CloudWatch alarms, service metrics
      src/
        app/
        application/
          services/                 ← MonitoringService (X-Ray, CloudWatch), AuthService
        modules/
        presentation/
          controllers/              ← TracesController, AlarmsController, ServicesController, AuthController
          filters/                  ← MonitoringExceptionFilter
          guards/                   ← JwtAuthGuard
    monitoring-webapp/              ← Internal monitoring dashboard (Next.js)
      src/
        app/                        ← Dashboard, traces, alarms pages
        lib/
          auth-provider.tsx         ← session token (localStorage) — internal tool only, not production auth
          use-monitoring-api.ts     ← typed fetch wrapper (Bearer token + X-Target-Environment header)

  mobile/                          ← Expo (React Native) mobile app
    src/
      app/                         ← Expo Router file-based routing
        _layout.tsx                ← root: SafeAreaProvider + QueryClientProvider + configureApi
        (tabs)/                    ← bottom tab navigator
          _layout.tsx              ← tab bar config
          index.tsx                ← Dashboard
          users.tsx                ← Users list + filter
          products.tsx             ← Products list + filter
          orders.tsx               ← Orders list + filter
        users/[userId].tsx         ← User detail + actions
        products/[productId].tsx   ← Product detail + actions
        orders/[orderId].tsx       ← Order detail + actions
      components/                  ← domain-scoped RN components
        users/
        products/
        orders/
      lib/
        status-variants.ts         ← badge variant mapping (mobile)

scripts/
  setup-localstack.ts            ← DynamoDB + SQS resource creation (loads .env.local)
  prisma-migrate-all.ts           ← Prisma migration runner for all domains (loads .env.local)

infra/
  bootstrap/                      ← One-time per-account AWS setup (S3 state, OIDC, ECR, IAM)
    main.tf
    variables.tf
    outputs.tf
  init-runner/                    ← Lambda one-shot handler for deploy tasks
    handler.mjs
    entrypoint.mjs
    scripts/                      ← Custom deploy scripts (seed data, etc.)
  modules/                        ← Reusable Terraform child modules
    cognito/                      ← Cognito User Pool + App Client
    networking/                   ← VPC, subnets, NAT, security groups
    dynamodb/                     ← Single DynamoDB table (for_each from registry)
    rds/                          ← RDS PostgreSQL
    sqs/                          ← SQS queue + DLQ pair
    s3/                           ← S3 bucket
    api-gateway/                  ← Shared API Gateway HTTP API v2 (one per environment)
    lambda-api/                   ← Lambda + route on shared API Gateway
    lambda-worker/                ← Lambda + SQS event source mapping
    lambda-webapp/                ← Webapp deployed as Lambda container image (legacy SSR)
    lambda-runner/                ← Lambda one-shot task for deploy tasks (ZIP from S3)
    webapp/                       ← ECS Fargate + ALB for Next.js (legacy SSR staging/prod)
    static-webapp/                ← S3 + CloudFront for static Next.js export (default all envs)
    secrets/                      ← Secrets Manager with random password
    notifications/                ← SNS topic + email subs + AWS Chatbot Slack channel
    monitoring/                   ← CloudWatch alarms (publishes to notifications SNS)
  environments/                   ← Root modules per environment
    dev/
    staging/
    prod/
    preview/                      ← Parameterized ephemeral environments

.github/
  workflows/
    cd-deploy.yml                 ← Main CD: push to develop→dev, main→staging, manual
    cd-preview-create.yml         ← Create/update preview environment
    cd-preview-destroy.yml        ← Tear down preview environment
    cd-infra-plan.yml             ← Terraform plan on PRs (infra/** changes)
```

**Important:** Backend uses **NestJS** in the presentation layer. Frontend uses **Next.js** (App Router) and **Expo** (React Native) with React Query and the shared `@mma/ui` (web) / `@mma/mobile-ui` (mobile) + `@mma/client-common` packages. **Deployment** uses Terraform modules driven by `.github/service-registry.json` — all AWS resources are created via `for_each` over the registry, so most service additions require zero `.tf` file edits.

---

## 2. Golden Rules (Always Enforced)

> The 47 Golden Rules are the always-on enforcement contract and live in the root
> [CLAUDE.md](../CLAUDE.md) § "Golden Rules" (many are also enforced by
> `scripts/lint-standards.ts`). They are not duplicated here to avoid drift — read them
> there before writing backend, frontend, mobile, auth, CD, or E2E code.

## 3. How to Add a New Domain (Step-by-Step)

### 0. Choose Persistence Layer

Before creating infrastructure, decide which persistence layer the domain will use:

|                      | DynamoDB OneTable                                                       | Prisma + PostgreSQL                                           |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Best for**         | Single-table design, high-throughput key-value access, serverless-first | Relational data, complex joins, aggregates, ACID transactions |
| **Pagination**       | Cursor-based (`IPaginatedResponse`)                                     | Offset-based (`IOffsetPaginatedResponse`)                     |
| **Local infra**      | LocalStack (DynamoDB)                                                   | Docker Postgres                                               |
| **Schema location**  | `infrastructure/schemas/{Entity}Schema.ts`                              | `infrastructure/prisma/schema.prisma`                         |
| **Repository skill** | `dynamo-repository`                                                     | `prisma-repository`                                           |
| **Schema skill**     | `new-dynamo-schema`                                                     | `new-prisma-schema`                                           |
| **Wiring skill**     | `nestjs-service-layers` (DynamoDB variant)                              | `prisma-service-wiring`                                       |

### A. Domain Package (`packages/{domain}-domain`)

1. **Create domain constants**
   - `domain/constants/*.ts`
2. **Create domain entity**
   - `domain/entities/{entity}.entity.ts`
3. **Create domain exceptions**
   - `domain/exceptions/*.error.ts`
4. **Create application exceptions** (input/validation)
   - `application/exceptions/*.error.ts`
5. **Create repository interface**
   - `application/interfaces/{entity}-repository.interface.ts`
6. **Create use cases**
   - `application/use-cases/{operation}/...`
7. **Create infrastructure schema + repository**
   - **DynamoDB path:**
     - `infrastructure/schemas/{Entity}Schema.ts`
     - `infrastructure/repositories/dynamo-{entity}.repository.ts`
   - **Prisma path:**
     - `infrastructure/prisma/schema.prisma`
     - `infrastructure/repositories/prisma-{entity}.repository.ts`
     - Run `npx prisma generate` to create the generated client

### B. Contracts Package (`packages/contracts/{domain}`)

Each domain has its own contracts package with `package.json`, `project.json`, and `tsconfig.json`.

1. Add Zod schemas in `packages/contracts/{domain}/src/schemas.ts`.
2. Re-export domain constants from the domain package.
3. Export TypeScript types from Zod schemas.

### C. Service App (`apps/{domain}/{service}`)

1. **Create application service**
   - `application/services/{entity}-application.service.ts`
2. **Create controller**
   - `presentation/controllers/{entity}.controller.ts`
3. **Add validation pipes**
   - `presentation/pipes/zod-validation.pipe.ts`
4. **Map domain errors to HTTP**
   - `presentation/filters/domain-exception.filter.ts`
5. **Wire everything in `modules/{domain}.module.ts`**

---

## 3.1 Required Wiring Details (Do Not Skip)

### NestJS Module Wiring (Provider Pattern)

In `apps/{domain}/{service}/src/modules/{domain}.module.ts`:

#### DynamoDB Wiring

- Provide a DynamoDB table token and factory using `DynamoDBConfig.getTable(...)`.
- Provide repository token wired to the DynamoDB table instance.
- Provide use cases as factory providers that take `I{Entity}Repository`.
- Provide the Application Service directly (class provider).
- Export only the Application Service — never export use cases or repositories.

**Rules to replicate for new domains:**

- Define `DYNAMO_TABLE` and `{ENTITY}_REPOSITORY` as local string constants (not enums).
- Every use case gets its own `useFactory` provider injecting the repository token.
- Application service is provided as a plain class (no factory needed).
- Token name follows `{ENTITY}_REPOSITORY` convention (`ORDER_REPOSITORY`, `PRODUCT_REPOSITORY`, etc.).

#### Prisma Wiring

For Prisma-based domains, replace the DynamoDB table token with a `PRISMA_CLIENT` token backed by `PrismaConfig`:

- Provide `PRISMA_CLIENT` token using `PrismaConfig.getClient()` (async factory — NestJS awaits the Promise).
- Provide repository token wired to the Prisma client instance.
- All other rules (use case factories, application service, exports) are identical to DynamoDB wiring.

**Key differences from DynamoDB:**

- No `DynamoDBConfig`, `Table`, or `UserSchema` imports.
- Import `PrismaClient` from the domain's generated client path.
- Import `PrismaConfig` from `../infrastructure/config/prisma.config`.
- The repository constructor receives `PrismaClient` instead of `Table`.
- Uses `{DOMAIN}_DATABASE_URL` env var instead of `{DOMAIN}_DYNAMODB_TABLE_NAME`.
- In Lambda: `AWS_SECRETS_ARN` is injected by Terraform. `SecretsConfig.resolve(['ORDERS_DATABASE_URL'])` (imported from `@mma/aws-secrets`) is called at Lambda cold-start (in `main.ts` handler) and populates only the keys this service needs from the project-level Secrets Manager secret before NestJS boots. `PrismaConfig.getClient()` then simply sets the engine path and creates the client — it no longer performs any ARN resolution.
- Import `SecretsConfig` from `@mma/aws-secrets` (`packages/aws/aws-secrets/`). This package wraps `@aws-sdk/client-secrets-manager` with the allow-list pattern.

See the `prisma-service-wiring` skill for the complete module template.

---

## 3.2 Quick Checklists

### New Feature Checklist (Existing Domain + Service)

- [ ] Add or update contracts in `packages/contracts/{domain}/src/schemas.ts`
- [ ] Add or update domain methods and exceptions in `packages/{domain}-domain/src/domain`
- [ ] Add or update use case in `packages/{domain}-domain/src/application/use-cases`
- [ ] Update repository interface if needed in `packages/{domain}-domain/src/application/interfaces`
- [ ] Update repository implementation in `packages/{domain}-domain/src/infrastructure/repositories`
- [ ] **DynamoDB path:** If a new GSI was added or removed from the schema, update `scripts/setup-localstack.ts` and run `pnpm run localstack:setup:force`
- [ ] **Prisma path:** If schema changed, run `npx prisma migrate dev` from the domain package
- [ ] Update application service in `apps/{domain}/{service}/src/application/services`
- [ ] Update controller and validation in `apps/{domain}/{service}/src/presentation/controllers`
- [ ] Register providers in `apps/{domain}/{service}/src/modules/{domain}.module.ts`
- [ ] Add tests (domain entity + use case; service tests if orchestration changes)
- [ ] Add or update E2E tests if endpoint affects critical user flows (see `write-api-e2e-tests` skill)

### New HTTP API Microservice Checklist (New Domain)

- [ ] Create `packages/{domain}-domain` with domain, application, infrastructure
- [ ] Create `packages/contracts/{domain}/` with `package.json`, `project.json`, `tsconfig.json`, `src/schemas.ts`
- [ ] Create `apps/{domain}/{service}` with application, presentation, modules (use `nestjs-service-layers` skill)
- [ ] **DynamoDB path:** Add DynamoDB schema and repository implementation
- [ ] **Prisma path:** Add Prisma schema, run `npx prisma generate`, and add repository implementation
- [ ] Add NestJS module wiring and main bootstrap
- [ ] Add health endpoint: `AppController` with `@Get('health')` + `@Public()` returning `{ status: 'ok', service: '{service-name}' }` (see `nestjs-service-layers` skill §2)
- [ ] Add `presentation/decorators/current-user.decorator.ts` and `presentation/types/express.d.ts` (copy from any existing service — see `current-user-decorator` skill). Required so controllers can read the authenticated actor (Golden Rule #45).
- [ ] Add `presentation/interceptors/http-logging.interceptor.ts` (copy from `apps/files/file-api-service/` — update the `createLogger` service name). Register via `app.useGlobalInterceptors(new HttpLoggingInterceptor())` in `main.ts`. Logs every request as `METHOD /path → status in Xms` with `actorId`, `correlationId`, `durationMs`.
- [ ] Add public route paths to `service-registry.json` → `gatewayAuth.publicRoutes` for any endpoint decorated with `@Public()` (see `gateway-jwt-auth` skill). The list MUST stay in sync with `@Public()` decorators — enforced by the `gateway-public-routes-sync` lint check.
- [ ] Wrap Swagger setup in `if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') { ... }` so OpenAPI docs are gated per environment (see `swagger-controller-docs` skill).
- [ ] Add route validation with `ZodValidationPipe`
- [ ] Add `DomainExceptionFilter` mapping
- [ ] Add/update `.env.local` at workspace root:
  - Common: `STAGE=local`, `NODE_ENV=production`, `{DOMAIN}_SERVICE_PORT`, `API_{DOMAIN}_URL=http://localhost:{PORT}/api`
  - **DynamoDB path:** `LOCALSTACK_ENDPOINT`, `DYNAMODB_ENDPOINT`, `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`, `{DOMAIN}_DYNAMODB_TABLE_NAME`
  - **Prisma path:** `{DOMAIN}_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}_db`
  - Claim the next available port from the registry in §7.1
- [ ] Update `.env.local.example` to match — use the `generate-env-local` skill (add-missing-keys mode) to produce the new entries
- [ ] Register VS Code tasks: add `Service: Serve {service-name}` to `.vscode/tasks.json` and append its label to the `dependsOn` array of `Services: Start All` (see `nx-microservice-scaffold` skill)
- [ ] **DynamoDB path:** Add the new table's `TableConfig` to `scripts/setup-localstack.ts`, then run `pnpm run localstack:setup:force`
- [ ] **Prisma path:** Add the Postgres service to `docker-compose.yml` (if not already present), run `npx prisma migrate dev`
- [ ] **Prisma path:** Register domain in `scripts/prisma-migrate-all.ts` → `PRISMA_DOMAINS` array
- [ ] **Prisma path:** Add `ignoreWarnings` for Prisma generated client in `webpack.config.js` (suppress missing source map warnings)
- [ ] **Prisma path:** Add Prisma engine binary + `schema.prisma` to webpack `assets` array (see `cd-register-service` skill § Prisma / Lambda Build Requirements)
- [ ] **Prisma path:** Import `SecretsConfig` from `@mma/aws-secrets` in `main.ts` Lambda handler and call `await SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` before NestJS bootstrap
- [ ] **Prisma path:** Add a `cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/` line in the CD workflow's "Package init-runner" step so the Prisma schema is included in the Lambda ZIP
- [ ] **Prisma path:** Add a `prisma-migrate` entry to `deployTasks[]` in `service-registry.json`
- [ ] Add `prune-lockfile`, `copy-workspace-modules`, and `prune` targets to `project.json` (required for Lambda ZIP packaging — see `nx-microservice-scaffold` skill)
- [ ] Add tests for domain and use cases
- [ ] Create API E2E project `apps/{domain}/{service}-e2e/` (see `write-api-e2e-tests` skill)
- [ ] Add E2E infrastructure (tables/DB/queues) to `scripts/setup-e2e.ts` (see `e2e-infrastructure` skill)
- [ ] **CI:** Add an entry to `.github/service-registry.json` — include `name` (Nx project), `distPath`, `domain`, `type`, `handler`, `memorySize`, `timeout`, and `envVars` array. If the service needs RDS/VPC access, set `requiresVpc: true`
- [ ] **CI:** Add per-service env vars to `.github/service-registry.env` — `{DOMAIN}_SERVICE_PORT`, `API_{DOMAIN}_URL`, `NEXT_PUBLIC_API_{DOMAIN}_URL`, persistence var (`{DOMAIN}_DYNAMODB_TABLE_NAME` or `{DOMAIN}_DATABASE_URL`), and SQS queue vars
- [ ] **CI (Prisma only):** Add a `postgres` service container to the `services:` block in `.github/workflows/ci-e2e.yml` and `.github/workflows/ci-test-all.yml`; add `{DOMAIN}_DATABASE_URL` to the `env:` of the `test-affected` job in `.github/workflows/ci-test-affected.yml`
- [ ] **CI (Prisma only):** Add the domain to `PRISMA_DOMAINS` in `scripts/prisma-generate-all.ts` — the `pnpm prisma:generate:all` step already runs in all CI jobs (no-op when empty), but adding the entry here is required so webpack can locate the Linux query engine binary on a fresh runner
- [ ] **CD (Infrastructure):** Add infrastructure entries to `.github/service-registry.json` → `infrastructure` section: `dynamodbTables` (with GSIs), `sqsQueues`, and/or `rds` entries as needed
- [ ] **CD (Webapp):** If this domain adds a new `NEXT_PUBLIC_*` env var, add it to `service-registry.json` → `webapp.envVars` and to the `Dockerfile` `ARG`/`ENV` block

### New Event-Driven (SQS Consumer) Microservice Checklist

Use the `sqs-event-driven-service` skill for all internal file templates.

- [ ] Create `packages/{domain}-domain` with domain, application, infrastructure (if domain package does not already exist)
- [ ] Create `apps/{domain}/{service}` — no `presentation/` folder (use `sqs-event-driven-service` skill)
- [ ] Follow `nx-microservice-scaffold` skill for Nx project files — **skip port registration**; install `@aws-sdk/client-sqs` + `@types/aws-lambda` instead of `@nestjs/swagger`
- [ ] Create `application/interfaces/normalized-sqs-record.interface.ts`
- [ ] Create `application/services/{domain}-event-handler.service.ts`
- [ ] Create `infrastructure/sqs/sqs-local.service.ts`
- [ ] Create `main.ts` with `STAGE=local` branching (no HTTP, no Swagger)
- [ ] Wire providers in `modules/{domain}.module.ts` — **no `controllers` array**; include `SqsLocalService`
- [ ] Add `{DOMAIN}_SQS_QUEUE_URL` and `{DOMAIN}_SQS_QUEUE_NAME` to `.env.local` — use `DEFAULT_REGION` value for the region segment in the URL; the URL must end in `.fifo` for FIFO queues (the default); do **not** add `AWS_DEFAULT_REGION`
- [ ] Update `.env.local.example` to match — use the `generate-env-local` skill (add-missing-keys mode) to produce the new entries
- [ ] Add a `QUEUE_CONFIGS` entry to `scripts/setup-localstack.ts` with `fifo: true` (the default), then run `pnpm run localstack:setup:force`
- [ ] Register VS Code tasks: add `Service: Serve {service-name}` to `.vscode/tasks.json` and append to `Services: Start All`
- [ ] Add tests for the event handler application service (with mocked use cases)

### New Webapp Feature Checklist

- [ ] Add or update API client methods in `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
- [ ] Add or update React Query hooks in `packages/client-common/src/hooks/use-{domain}.ts`
- [ ] Add or update contracts types/schemas used by the API client (in `@mma/contracts/{domain}`)
- [ ] Add or update domain components in `apps/webapp/src/components/{domain}/`
- [ ] Update page orchestration in `apps/webapp/src/app/{domain}/page.tsx`
- [ ] If new entity statuses exist, add badge variant mapping in `apps/webapp/src/lib/status-variants.ts`
- [ ] If a new UI primitive is needed, add it to `packages/ui/src/components/`
- [ ] Add `NEXT_PUBLIC_API_{DOMAIN}_URL` to `.env.local` and `client-common` config if new domain
- [ ] Add `data-testid` attributes to new components for E2E testing (see `write-webapp-e2e-tests` skill)
- [ ] Add Playwright E2E specs in `apps/webapp-e2e/src/specs/{domain}/` if new domain

### New Mobile Feature Checklist

- [ ] Add or update API client methods in `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts` (shared with webapp — skip if already done in Webapp Feature Checklist)
- [ ] Add or update React Query hooks in `packages/client-common/src/hooks/use-{domain}.ts` (shared with webapp — skip if already done)
- [ ] Add or update domain components in `apps/mobile/src/components/{domain}/`
- [ ] Update or create screen in `apps/mobile/src/app/(tabs)/{domain}.tsx` (tab screen) or `apps/mobile/src/app/{domain}/[{entity}Id].tsx` (detail screen)
- [ ] If new entity statuses exist, add badge variant mapping in `apps/mobile/src/lib/status-variants.ts`
- [ ] If a new mobile UI primitive is needed, add it to `packages/mobile-ui/src/components/`
- [ ] If new domain: register tab in `apps/mobile/src/app/(tabs)/_layout.tsx`
- [ ] If new domain: add `EXPO_PUBLIC_API_{DOMAIN}_URL` to `apps/mobile/src/app/_layout.tsx` configureApi call

---

## 4. Persistence Patterns

### 4A. DynamoDB OneTable Pattern (Actual Implementation)

#### DynamoDB Config (Shared Client + Tables)

```
apps/{domain}/{domain}-api-service/src/infrastructure/config/dynamodb.config.ts
```

Key rules:

- **One Dynamo client per process** (singleton).
- **Multiple tables supported** via `getTable(name, schema)` registry.
- **`isLocal` uses `STAGE === 'local'`** as the primary check, with `DYNAMODB_ENDPOINT` as an explicit override. Never use `NODE_ENV === 'development'` for this — `NODE_ENV=production` is correct locally.
- **Table name from env**: `DynamoDBConfig.getTable(process.env.{DOMAIN}_DYNAMODB_TABLE_NAME || 'OldSTTable', Schema)`. Use the plural domain name (e.g. `USERS_DYNAMODB_TABLE_NAME`, `PRODUCTS_DYNAMODB_TABLE_NAME`). The table name lives in `.env.local`.

#### DynamoDB Repository Pattern

```
packages/{domain}-domain/src/infrastructure/repositories/dynamo-{entity}.repository.ts
```

Key rules:

- Keep conversion methods private: `toDomain()` and `toPersistence()`.
- Use `pageRecordHandler` for cursor pagination.
- Infrastructure may define **local structural interfaces** to avoid OneTable generic type explosions.

#### DynamoDB Schema Conventions

- Use explicit GSI naming consistent with the domain (e.g., GSI1, GSI4, GSI5).
- Model attributes must align with domain invariants (e.g., required fields).
- Email lookup uses a dedicated GSI (do not scan).
- Role/status list endpoints should use a GSI with PK = `ROLE#STATUS` or `STATUS` pattern.

### 4B. Prisma + PostgreSQL Pattern

#### Prisma Config (Singleton Client)

```
apps/{domain}/{domain}-api-service/src/infrastructure/config/prisma.config.ts
```

Key rules:

- **One Prisma client per process** (singleton).
- Import `PrismaClient` from the domain's generated client path (`@mma/{domain}-domain/infrastructure` re-exports it).
- **`getClient()` is async** — returns `Promise<PrismaClient>`. NestJS `useFactory` handles this transparently.
- **`DATABASE_URL` from env**: Locally (`STAGE=local`), the env var is a plain `postgresql://` URL from `.env.local`. In deployed Lambda, `SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` is called first in the Lambda handler and populates only that key from the project-level Secrets Manager secret (`AWS_SECRETS_ARN`) — by the time `PrismaConfig.getClient()` runs, the URL is already resolved. `PrismaConfig` only sets the engine path and creates the client.
- **Lambda engine path**: When `STAGE !== 'local'`, sets `PRISMA_QUERY_ENGINE_LIBRARY` to `path.join(__dirname, 'libquery_engine-rhel-openssl-3.0.x.so.node')` so Prisma finds the binary copied to `/var/task` by webpack.
- See the `prisma-service-wiring` skill for the complete `PrismaConfig` template.

#### Prisma Repository Pattern

```
packages/{domain}-domain/src/infrastructure/repositories/prisma-{entity}.repository.ts
```

Key rules:

- Keep conversion methods private: `toDomain()` and `toPersistence()`.
- Use **offset-based pagination** with `skip`/`take` and `Promise.all([findMany, count])`.
- Return `IOffsetPaginatedResponse` (from `@mma/common`) with `data`, `total`, `page`, `limit`, `totalPages`.
- Use `$transaction` for aggregate saves (e.g., order with items).
- Cascade delete is handled by Prisma schema `onDelete: Cascade` — repository calls `delete()` on the root entity only.
- Infrastructure may define **local structural interfaces** to avoid Prisma generated-type leaking into domain.

#### Prisma Schema Conventions

```
packages/{domain}-domain/src/infrastructure/prisma/schema.prisma
```

- Enums in the Prisma schema must mirror domain constants exactly (Golden Rule #17).
- Use `@id @default(uuid())` for primary keys.
- Use `@default(now())` for `dateCreated` and `@updatedAt` for `updatedAt`.
- Use `@@map("table_name")` to map model names to snake_case table names.
- Relation cascading: set `onDelete: Cascade` on child models so deleting the parent cleans up children.
- Indexes: add `@@index([field])` for fields used in `WHERE` clauses of list queries.

#### Migration Workflow

```bash
# From packages/{domain}-domain (local only):
npx prisma migrate dev --name describe_change   # Create + apply migration
npx prisma generate                              # Regenerate client after schema changes
```

**Deployed environments:** RDS is in a private VPC — the CI runner cannot reach it. Migrations are applied via the **Lambda init-runner** — a one-shot Lambda function that runs registered deploy tasks (migrations, seeds, custom scripts) from within the VPC. The init-runner is defined in `infra/init-runner/` (`handler.mjs` + `entrypoint.mjs` + `scripts/`) and driven by the `deployTasks` array in `service-registry.json`. Each task entry specifies a `type` (`prisma-migrate`, `custom-script`, `dynamodb-seed`, `s3-init`), plus `secretEnvVars` and `envVars` arrays that the Terraform module resolves automatically. When `deployTasks` is empty, zero Lambda resources are created and the CD workflow skips the init-runner job entirely — zero cost. The CD workflow packages `handler.mjs` + `scripts/` + Prisma schemas into a ZIP, uploads it to S3 (`{project}/{env}/init-runner/{sha}.zip`), updates the Lambda function code, then invokes it synchronously. The handler reads `AWS_SECRETS_ARN` and a `SECRETS_ALLOW_LIST` env var to resolve only the declared secret keys before dispatching tasks. For Prisma migrations, the Lambda has `prisma` installed and runs `prisma migrate deploy` with the schema at `/var/task/prisma/{domain}/schema.prisma`. Never attempt to run `prisma migrate deploy` from a CI runner against a VPC-private RDS instance.

---

## 5. API Conventions

### REST Naming Rules (Industry Standard — Always Follow)

#### Resource Naming

- Use **plural nouns** for collections: `/users`, `/orders`, `/products` — never `/user` or `/getUsers`.
- Use **kebab-case** for multi-word resources: `/order-items`, `/role-assignments` — never camelCase or snake_case.
- Use **lowercase only** in all paths.
- Never use verbs in resource names: `/users/:id/activate` (correct), `/activateUser` (forbidden).

#### HTTP Verbs

| Intent                      | Method   | Example                        |
| --------------------------- | -------- | ------------------------------ |
| Create resource             | `POST`   | `POST /users`                  |
| Read collection             | `GET`    | `GET /users`                   |
| Read single resource        | `GET`    | `GET /users/:userId`           |
| Full replace                | `PUT`    | `PUT /users/:userId`           |
| Partial update              | `PATCH`  | `PATCH /users/:userId`         |
| Delete                      | `DELETE` | `DELETE /users/:userId`        |
| Trigger action/state change | `POST`   | `POST /users/:userId/activate` |

#### Path Parameters vs Query Strings

- Use **path parameters** for identity/lookup by ID: `/users/:userId`.
- Use **query parameters** for filtering, searching, sorting, and pagination: `?status=active&cursor=abc&direction=next`.
- Never put filter values in the path: `/users/active` (wrong), `/users?status=active` (correct).
- Exception: sub-resource listing where the filter is structural is acceptable when backed by a GSI: `/users/by-status`.

#### State-Changing Actions (Sub-Resource Pattern)

- Model state transitions as sub-resources under the entity using `POST`:
  - `POST /users/:userId/activate`
  - `POST /users/:userId/deactivate`
  - `POST /users/:userId/verify-email`
- Use `PATCH` for field-level updates:
  - `PATCH /users/:userId/role`

#### Response Status Codes

| Scenario                               | Code                        |
| -------------------------------------- | --------------------------- |
| Resource created                       | `201 Created`               |
| Success with body                      | `200 OK`                    |
| Success, no body                       | `204 No Content`            |
| Validation error                       | `400 Bad Request`           |
| Not found                              | `404 Not Found`             |
| Conflict (already exists, wrong state) | `409 Conflict`              |
| Server error                           | `500 Internal Server Error` |

#### Versioning

- Prefix all routes with `/v1/` (e.g., `/v1/users`) when the service is publicly exposed or shared across clients.
- Internal service-to-service APIs may omit versioning if consumed only within the monorepo.

---

### Validation Flow

1. Zod validation in controller using `ZodValidationPipe`.
2. Typed input passed into Application Service.
3. Use case enforces workflow + domain rules.
4. Domain entity enforces invariants.

### DTO Mapping Contract

- Application services must **transform domain entities into DTOs** using `@mma/contracts` schemas.
- Controllers return DTOs only; domain entities never cross the presentation boundary.
- Use Zod schemas (e.g., `userResponseSchema.parse(...)`) to validate outputs.

---

## 6. Exception Strategy

### Typed Exceptions

- Application exceptions (e.g., `InvalidInputError`) map to 400.
- Domain exceptions map to 409 or 404.

### Use Case Error Policy

- Use cases must throw **typed application errors** (e.g., `InvalidInputError`), not generic `Error`.
- Domain entities throw **domain errors**; use cases pass them through.

### HTTP Mapping

```
apps/{domain}/{domain}-api-service/src/presentation/filters/domain-exception.filter.ts
```

Rules:

- Always check `HttpException` first.
- Always use `getResponse()` (preserves Zod issues).
- Wrap the `DOMAIN_ERROR_MAP` loop in `if (exception instanceof Error)` — this narrows the type so no `as Error` casts are needed inside the loop.
- Log unexpected errors with both `Logger` and `console.error` (NestJS Logger can be silenced in Lambda). Include the error class name and message in the log, not just "Unexpected error".
- The fallback 500 response must include the actual error class name in `error` and the actual error message in `message` — never return generic `'InternalServerError'` / `'An unexpected error occurred'`.
- ACL exceptions (cross-service validation failures) belong in the same `DOMAIN_ERROR_MAP` as domain exceptions — map them to 404, 409, or 502 as appropriate.

### Standardized Error Response Shape

All `DomainExceptionFilter` implementations **must** use the same JSON shape for domain/application errors and fallback errors:

```json
{ "statusCode": 409, "error": "CannotModifyNonDraftOrderError", "message": "Order must be in DRAFT status" }
```

Fields:

- `statusCode` — HTTP status code (number).
- `error` — Exception class name (`exception.constructor.name`).
- `message` — Human-readable error message (`exception.message`).

**Never** include `timestamp` in error responses. **Never** omit the `error` field. This shape must be identical across all services.

---

## 7. Type Safety and Validation

- **Domain constants** in `packages/{domain}-domain/src/domain/constants`.
- **Contracts** re-export constants and define Zod schemas.
- **Repositories use @mma/common interfaces** for pagination (type-only).

### Pagination Contract (Must Match Repositories)

#### Cursor-Based (DynamoDB Domains)

- Input uses `direction: 'next' | 'prev'` with a single `cursor`.
- Application services must route `cursor` to `nextCursorPointer` or `prevCursorPointer` based on `direction`.
- Response returns both `nextCursorPointer` and `prevCursorPointer`.

#### Offset-Based (Prisma Domains)

- Input uses `page` (1-based, default 1) and `limit` (default 20).
- Application services pass `page` and `limit` directly to the repository.
- Response returns `data`, `total`, `page`, `limit`, `totalPages`.

---

## 7.1 Environment Variables (`.env.local`)

A `.env.local` file at the workspace root is required for all local development. It is gitignored and must never be committed.

### Local Infrastructure — Docker + LocalStack

All local AWS services (DynamoDB, S3, SQS) are provided by **LocalStack** running in Docker (`docker-compose.yml` at workspace root). Gateway listens on port `4566`. Use `docker compose up -d` to start, `docker compose down -v` to wipe data.

> **Credentials:** LocalStack accepts any non-empty credentials. `.env.local` provides `AWS_ACCESS_KEY_ID=test` / `AWS_SECRET_ACCESS_KEY=test`.

### VS Code Task Chain (`Dev: Start All`)

The `.vscode/tasks.json` provides compound tasks at three levels: infrastructure-only, per-domain, and full-stack.

- **`Infra: Start All`** (sequence) — Node version check → Docker + LocalStack → Prisma migrations. Run once per dev session.
- **`Domain: Start {User|Product|Order}`** — Runs `Infra: Start All` then launches that domain's API + event handler services.
- **`Services: Start All`** (parallel) — All backend services + webapp.
- **`Dev: Start All`** (sequence) — `Infra: Start All` → `Services: Start All`.

**Key design points:**

- `Infra: Start All` runs **sequentially** before any service to prevent race conditions.
- `Services: Start All` runs all services in **parallel** after infrastructure is ready.
- When adding a new service, add its `Service: Serve {name}` task to `Services: Start All` `dependsOn` and the appropriate `Domain: Start {Domain}`.
- When adding a new Prisma domain, register in `scripts/prisma-migrate-all.ts` → `PRISMA_DOMAINS`.
- When adding a new domain, add a `Domain: Start {Domain}` compound task.

### Environment Variable Reference

| Variable                       | Local value                                                                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STAGE`                        | `local`                                                                                      | **Single source of truth** for local mode. Controls `main.ts` bootstrap path and `DynamoDBConfig` client selection.                                                                                                                                                                                                                                                                                                             |
| `NODE_ENV`                     | `production`                                                                                 | Matches the webpack/NestJS production build. Does **not** control DynamoDB routing.                                                                                                                                                                                                                                                                                                                                             |
| `LOCALSTACK_ENDPOINT`          | `http://localhost:4566`                                                                      | LocalStack Gateway URL. Consumed by `createLocalStackClient()` and any future AWS SDK clients.                                                                                                                                                                                                                                                                                                                                  |
| `DYNAMODB_ENDPOINT`            | `http://localhost:4566`                                                                      | Explicit override consumed by `createDynamoLocalClient()` inside `DynamoDBConfig.getClient()`. Points at the LocalStack Gateway.                                                                                                                                                                                                                                                                                                |
| `AWS_ACCESS_KEY_ID`            | `test`                                                                                       | Fake credential accepted by LocalStack. **Remove when deploying to AWS** — real credentials come from IAM roles.                                                                                                                                                                                                                                                                                                                |
| `AWS_SECRET_ACCESS_KEY`        | `test`                                                                                       | Fake credential accepted by LocalStack. **Remove when deploying to AWS.**                                                                                                                                                                                                                                                                                                                                                       |
| `{DOMAIN}_DYNAMODB_TABLE_NAME` | `OldSTTable`                                                                                 | Per-domain table name (e.g. `USERS_DYNAMODB_TABLE_NAME`, `PRODUCTS_DYNAMODB_TABLE_NAME`). Each domain module reads its own var. All can share one physical table or point to separate tables — decided at deploy time. DynamoDB domains only.                                                                                                                                                                                   |
| `{DOMAIN}_DATABASE_URL`        | `postgresql://dev:dev@localhost:5432/{domain}_db`                                            | Per-domain PostgreSQL connection string (e.g. `ORDERS_DATABASE_URL`). Used **locally only** — `PrismaConfig.getClient()` reads it directly. In Lambda, this var is populated at cold-start by `SecretsConfig.resolve(['{DOMAIN}_DATABASE_URL'])` from the project-level `AWS_SECRETS_ARN` secret — only the keys the service declares are written to `process.env`. Prisma domains only.                                        |
| `{DOMAIN}_SERVICE_PORT`        | service-specific                                                                             | Per-service port var (e.g. `USER_SERVICE_PORT=3000`, `PRODUCT_SERVICE_PORT=3001`). Each service reads its own var so all services can run simultaneously without shell tricks.                                                                                                                                                                                                                                                  |
| `API_{DOMAIN}_URL`             | `http://localhost:{PORT}/api`                                                                | Base URL consumed by frontend apps to reach a specific API service (e.g. `API_USER_URL`, `API_PRODUCT_URL`). Derived from `{DOMAIN}_SERVICE_PORT` — always `http://localhost:{PORT}/api`.                                                                                                                                                                                                                                       |
| `FE_BASE_URL`                  | `http://localhost:4200`                                                                      | Base URL of the frontend application. Used for CORS configuration, OAuth redirects, and cross-service references.                                                                                                                                                                                                                                                                                                               |
| `{DOMAIN}_SQS_QUEUE_URL`       | `http://sqs.{DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/{queue-name}.fifo` | Full SQS queue URL consumed by `SqsLocalService` during local polling. LocalStack exposes SQS via the DNS-based format `http://sqs.{region}.localhost.localstack.cloud:4566/000000000000/{queue-name}`. FIFO is the default — queue names and URLs end in `.fifo`. For explicit Standard queues, omit the `.fifo` suffix. The region segment must match `DEFAULT_REGION`. The `000000000000` is the LocalStack fake account ID. |
| `{DOMAIN}_SQS_QUEUE_NAME`      | `{queue-name}`                                                                               | Physical SQS queue base name (without `.fifo` suffix). Used by `scripts/setup-localstack.ts` to create the queue via `QUEUE_CONFIGS`. The setup script auto-appends `.fifo` when `fifo: true` (the default).                                                                                                                                                                                                                    |
| `DEFAULT_REGION`               | `eu-west-2`                                                                                  | AWS region used by SQS local polling clients, LocalStack queue URL construction, and E2E infrastructure scripts. **Not the same as `AWS_REGION`** (which is auto-injected by Lambda). Used only for local/CI contexts.                                                                                                                                                                                                          |
| `NEXT_PUBLIC_API_{DOMAIN}_URL` | `http://localhost:{PORT}/api`                                                                | Per-domain API base URL exposed to the Next.js webapp. Maps to `API_{DOMAIN}_URL` values. Consumed by `configureApi()` in `layout.tsx`.                                                                                                                                                                                                                                                                                         |
| `COGNITO_USER_POOL_ID`         | (empty locally)                                                                              | AWS Cognito User Pool ID. Used by `CognitoAuthProvider` in deployed environments. Locally, `LocalAuthProvider` is used instead (no Cognito needed).                                                                                                                                                                                                                                                                             |
| `COGNITO_CLIENT_ID`            | (empty locally)                                                                              | AWS Cognito App Client ID. Same usage as above.                                                                                                                                                                                                                                                                                                                                                                                 |
| `COGNITO_REGION`               | `eu-west-2`                                                                                  | AWS region for the Cognito User Pool. Used by `CognitoAuthProvider` to construct the SDK client.                                                                                                                                                                                                                                                                                                                                |

**Port and API URL registry — claim the next available port when adding a new HTTP API service:**

| Port   | Service                  | Port env var           | API URL env var                                        |
| ------ | ------------------------ | ---------------------- | ------------------------------------------------------ |
| `3000` | `user-api-service`       | `USER_SERVICE_PORT`    | `API_USER_URL=http://localhost:3000/api`               |
| `3001` | `product-api-service`    | `PRODUCT_SERVICE_PORT` | `API_PRODUCT_URL=http://localhost:3001/api`            |
| `3002` | `order-api-service`      | `ORDER_SERVICE_PORT`   | `API_ORDER_URL=http://localhost:3002/api`              |
| `3003` | `auth-api-service`       | `AUTH_SERVICE_PORT`    | `API_AUTH_URL=http://localhost:3003/api`               |
| `3004` | `file-api-service`       | `FILE_SERVICE_PORT`    | `API_FILE_URL=http://localhost:3004/api`               |
| `8080` | `monitoring-api-service` | `MONITORING_API_PORT`  | _(internal tool — no `API_\*_URL` entry)_              |
| `4300` | `monitoring-webapp`      | _(Next.js dev server)_ | `NEXT_PUBLIC_MONITORING_API_URL=http://localhost:8080` |

> **Event-driven (SQS consumer) services do not register a port.** They have no HTTP server. Do not add `{DOMAIN}_SERVICE_PORT` or `API_{DOMAIN}_URL` entries for event-driven services.

**Rules:**

- `STAGE=local` is the **only** env var that must be checked for local-vs-AWS branching. Never use `NODE_ENV === 'development'` for this.
- Each HTTP API service must use **`{DOMAIN}_SERVICE_PORT`** — never the generic `PORT` var. Event-driven services do not use a port var.
- New HTTP API services must claim the next available port in the registry above.
- Every new HTTP API service must also add `API_{DOMAIN}_URL` and `NEXT_PUBLIC_API_{DOMAIN}_URL` to `.env.local`.
- `FE_BASE_URL` is a single entry shared across all services — do not add one per service.
- For Prisma-based services, add a `{DOMAIN}_DATABASE_URL` env var and ensure the Postgres service is defined in `docker-compose.yml`.
- When adding new AWS services to LocalStack (e.g. S3), add them to `SERVICES=` in `docker-compose.yml`. SQS is already active (`SERVICES=dynamodb,sqs`).

### CI/CD Service Registry (`.github/service-registry.*`)

When adding a new HTTP API service, two files act as the **single source of truth** for CI and CD — all CI E2E workflows AND all Terraform environment roots read from them automatically:

| File                            | Purpose                                                                                                                                                                                                                                                                                                                             | What to add                                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/service-registry.json` | Lists every service with deployment metadata (Nx project name, distPath, domain, handler, memorySize, timeout, envVars, requiresVpc). Used by CI workflows to build/start services AND by Terraform `for_each` to create Lambda functions, API Gateways, SQS event source mappings, DynamoDB tables, RDS instances, and SQS queues. | Add to `apiServices` or `eventHandlerServices` array for services; add to `infrastructure.dynamodbTables`, `infrastructure.sqsQueues`, `infrastructure.rds`, or `infrastructure.s3Buckets` for resources |
| `.github/service-registry.env`  | Declares all per-service E2E env vars (ports, API URLs, `NEXT_PUBLIC_*`, table/DB names, queue names). Sourced at runtime via `cat ... >> $GITHUB_ENV`.                                                                                                                                                                             | One section of env vars per new domain                                                                                                                                                                   |

#### Why Two Files? (Dual-Registry Design)

The two files serve **different consumers in different contexts** and cannot be merged:

|                  | `service-registry.json`                                                                                                                                                                               | `service-registry.env`                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Consumer**     | Terraform (CD) + CI build/start scripts                                                                                                                                                               | CI E2E workflows (`$GITHUB_ENV`)                                                       |
| **Format**       | Structured JSON with metadata (name, domain, handler, memory, timeout, `envVars[]`)                                                                                                                   | Flat `KEY=VALUE` pairs                                                                 |
| **Env var role** | `envVars[]` is a **whitelist** of env var _names_ — tells Terraform which vars to inject into each Lambda. Terraform resolves the _values_ from its own module outputs (table ARNs, queue URLs, etc.) | Provides the _actual values_ for CI — specific ports, LocalStack URLs, E2E table names |
| **Where read**   | `jsondecode(file(...))` in every Terraform env root; `node -e` in CI build/start scripts                                                                                                              | `grep >> $GITHUB_ENV` in `ci-e2e.yml`                                                  |

**Why they can't be one file:** Terraform needs structured metadata (which service gets which Lambda config, memory, timeout, VPC) plus a machine-readable whitelist of env var _names_. CI needs concrete _values_ (ports, LocalStack URLs) in a format that `$GITHUB_ENV` understands (flat key=value). The values are fundamentally different — CI uses `http://localhost:3000/api`, Terraform generates `https://xxx.execute-api.../user/api`.

**Drift protection:** The `service-registry-env-sync` check in `scripts/lint-standards.ts` (run by `ci-fast-check.yml`) validates that every SQS/DynamoDB/database env var referenced in a service's module code is declared in **both** files. This prevents the scenario where E2E passes (has the var) but Lambda crashes (missing the var).

#### Service Registry JSON Structure

The `service-registry.json` has five top-level sections:

| Section                  | Content                                                                 | Terraform consumer                                                                |
| ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apiServices[]`          | HTTP API services → Lambda + route on shared API Gateway                | `module.api_gateway` (shared gateway) + `module.api_services` (lambda-api module) |
| `eventHandlerServices[]` | SQS consumer services → Lambda + SQS event source mapping               | `module.worker_services` (lambda-worker module)                                   |
| `webapp`                 | Next.js static export → S3 + CloudFront (all envs)                      | `module.static_webapp` (static-webapp module)                                     |
| `infrastructure`         | DynamoDB tables, SQS queues, S3 buckets, RDS PostgreSQL databases       | Individual `module.dynamodb`, `module.sqs`, `module.s3`, `module.rds` blocks      |
| `deployTasks[]`          | One-shot deploy tasks (migrations, seeds, scripts) → Lambda init-runner | `module.lambda_runner` (lambda-runner module)                                     |

**Each API/worker service entry includes:** `name` (Nx project), `distPath` (built main.js), `domain`, `type` (api/worker), `handler`, `memorySize`, `timeout`, `envVars[]`, and optionally `requiresVpc` and `sqsQueueRef`.

**Terraform reads this file** as `local.registry = jsondecode(file("${path.module}/../../../.github/service-registry.json"))` and iterates with `for_each`. Adding a new service to the JSON automatically creates all AWS resources on the next `terraform apply` — no `.tf` file edits needed.

The `ci-test-affected.yml` workflow uses `nx affected --target=test` and is **fully zero-maintenance** — new domains are automatically picked up without any workflow changes.

The only CI changes that **cannot be automated** for new **Prisma** domains are:

1. Adding a `postgres` service container — in `ci-e2e.yml`, `ci-test-all.yml`, and the `test-affected` job env in `ci-test-affected.yml`.
2. Adding the domain to `PRISMA_DOMAINS` in `scripts/prisma-generate-all.ts` — the `pnpm prisma:generate:all` step already runs in all CI jobs (as a no-op on the base template). Adding the entry is required so webpack can locate the Linux query engine binary on a fresh runner.

### CI Workflow Permissions

Any workflow that uses `nrwl/nx-set-shas@v4` **must** declare a top-level `permissions` block. Without it, the action fails with "Resource not accessible by integration" on repositories with restrictive default token permissions.

```yaml
permissions:
  actions: read # required by nrwl/nx-set-shas@v4 to query workflow runs
  contents: read # required by actions/checkout
```

This applies to `ci-fast-check.yml`, `ci-test-affected.yml`, and `ci-test-all.yml`. If you create a new workflow that uses `nx-set-shas`, add this block immediately after the `on:` trigger.

---

## 7.2 Inter-Service Communication Patterns

This template demonstrates three integration patterns between bounded contexts. Each pattern has a dedicated skill with full implementation instructions.

### Pattern 1 — Synchronous Cross-Service Call (ACL)

**When:** A use case needs a real-time answer from another service before proceeding (gate check).

**Example:** Order API validates that the customer exists and is active by calling User API before creating an order.

**Skill:** `sync-cross-service-call`

**Architecture:**

- **Port** (abstract class): `packages/{consuming-domain}-domain/src/application/interfaces/{upstream-entity}-validator.interface.ts`
- **Adapter** (HTTP client): `apps/{consuming-domain}/{service}/src/infrastructure/clients/{upstream-domain}-api.client.ts`
- **Wiring:** `HttpModule` import + `useClass` provider in NestJS module

**Key rules:**

- The consuming domain defines its own interface and response type — never imports from the upstream domain package.
- The use case receives the ACL validator via constructor injection alongside the repository.
- HTTP error mapping (404→domain not found, 409→invalid state, 5xx→service unavailable) happens in the adapter, not the use case.
- Always set a timeout on cross-service calls.
- Always propagate correlationId via `...getCorrelationHeaders()` in outbound HTTP headers (Golden Rule #36).
- ACL adapter must have before/after `logger.info()` calls so the outbound call appears in the monitoring event chain. The upstream service's application method must also log (even for read endpoints) so it appears as a participant in the chain.
- Uses `API_{UPSTREAM_DOMAIN}_URL` from `.env.local`.

### Pattern 2 — Cross-Domain Async Events (Published Language)

**When:** One domain needs to react to lifecycle events from another domain, with eventual consistency being acceptable.

**Example:** Order Event Handler reacts to product price changes or product discontinuation events published by Product API.

**Skills:** `sqs-event-publisher` (publishing side) + `cross-domain-event-handler` (consuming side)

**Architecture:**

- **Publisher:** Product API → `SqsStandardEventPublisher` → SQS queue
- **Consumer:** SQS queue → Order Event Handler → consuming domain's use cases
- **Shared contract:** `@mma/contracts/{publishing-domain}/event-schemas.ts` (Published Language)

**Key rules:**

- The consumer imports event schemas from `@mma/contracts/{publishing-domain}` only — never from `@mma/{publishing-domain}-domain`.
- Handlers write to the consuming domain's own repository — never to the publishing domain's table.
- Queue naming: consumer-owned inbox pattern — `{consuming-domain}-events` (e.g., `order-events`, `product-events`).

### Pattern 3 — Intra-Domain Async Events

**When:** A service within the same domain reacts to its own domain events.

**Example:** User API publishes `USER_DELETED` events consumed by User Event Handler (same bounded context).

**Skill:** `sqs-event-driven-service`

**Architecture:**

- Both publisher and consumer import from `@mma/contracts/{own-domain}` and `@mma/{own-domain}-domain`.
- Standard intra-domain pattern — no ACL boundary needed.

### Pattern 4 — Choreography Saga (Multi-Step Cross-Domain Workflow)

**When:** An operation requires asynchronous coordination between two bounded contexts with a request→response cycle and eventual state resolution.

**Example:** Order creation triggers product validation — Order API publishes `ORDER_CREATED` to `product-events` queue → Product Event Handler validates products → publishes `PRODUCT_VALIDATION_SUCCEEDED` or `PRODUCT_VALIDATION_FAILED` to `order-events` queue → Order Event Handler resolves the order state (DRAFT → PENDING or DRAFT → VALIDATION_FAILED).

**Skills:** `sqs-event-publisher` (both publishing sides) + `cross-domain-event-handler` (both consuming sides) + `domain-business-rules` (saga-driven state transitions)

**Architecture:**

- **Initiator:** Order API → `CreateOrderUseCase` publishes `ORDER_CREATED` (from use case, not app service — D2=Option B)
- **Responder:** Product Event Handler → validates products via `IProductRepository` → publishes validation result
- **Resolver:** Order Event Handler → idempotent handlers call `ApproveProductValidationUseCase` or `FailOrderValidationUseCase`
- **Queues:** Consumer-owned inbox: `product-events` (TO product domain), `order-events` (TO order domain)
- **Contract:** Each domain exposes its event schemas in `@mma/contracts/{domain}/event-schemas.ts`

**Key rules:**

- The initiating domain starts in a provisional state (DRAFT) — not the final state.
- The responding domain publishes a **result event** (success/failure) — not a command.
- Handlers in the resolving domain must be **idempotent**: check the order status before transitioning; if already resolved, log and skip (catch the domain exception, don't rethrow).
- Each saga participant only writes to its own domain's repository.
- Event publishing happens in the **use case**, not the application service (keeps the use case self-contained, consistent with ACL injection pattern).

### Decision Matrix

| Question                                                      | Sync (ACL)        | Async (Cross-Domain) | Async (Intra-Domain) | Choreography Saga           |
| ------------------------------------------------------------- | ----------------- | -------------------- | -------------------- | --------------------------- |
| Can the operation proceed without the answer?                 | No                | Yes                  | Yes                  | No (deferred)               |
| Is the consuming service in a different bounded context?      | Yes               | Yes                  | No                   | Yes (both directions)       |
| Does the consumer import from the publisher's domain package? | Never             | Never                | Yes (same domain)    | Never                       |
| Is there an ACL adapter?                                      | Yes (HTTP client) | No                   | No                   | No                          |
| Queue ownership                                               | N/A               | Consumer inbox       | Publisher            | Consumer inbox              |
| State resolution                                              | Immediate         | Fire-and-forget      | Fire-and-forget      | Eventual (request→response) |

---

## 8. Webapp Architecture (Next.js Frontend)

### Frontend Layering

```
Page (apps/webapp/src/app/{domain}/page.tsx)
  -> Domain Components (apps/webapp/src/components/{domain}/)
    -> React Query Hooks (packages/client-common/src/hooks/)
      -> API Clients (packages/client-common/src/infrastructure/api-clients/)
        -> Backend REST APIs
```

**Dependency rule:** Pages import components and hooks. Components import hooks and UI primitives. Hooks import API clients. API clients import contracts for Zod response parsing. No layer reaches more than one level down.

### Package Responsibilities

| Package                 | Purpose                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mma/ui`            | Shadcn-style primitives (Badge, Button, Card, Table, Input, Select) + `cn()` utility (clsx + tailwind-merge). No domain logic. See `webapp-ui-primitive` skill.                                     |
| `@mma/client-common` | Framework-agnostic API clients (`infrastructure/`), React Query hooks (`hooks/`), shared QueryClient config + Providers (`lib/`). Shared by webapp and mobile. See `webapp-api-client-hooks` skill. |
| `apps/webapp`           | Next.js App Router shell, page orchestrators, domain-scoped components, status-variant mapping. See `webapp-new-page` skill.                                                                        |

### Component Conventions

- **Domain-scoped folders:** `apps/webapp/src/components/{domain}/` (e.g., `users/`, `orders/`, `products/`).
- **Layout components:** `apps/webapp/src/components/layout/` (Header, Sidebar).
- All components use `@mma/ui` primitives — never raw HTML `<table>`, `<button>`, `<input>`.
- **Status badge variants** are mapped in `apps/webapp/src/lib/status-variants.ts` using enum constants from `@mma/contracts/{domain}` — never hardcoded strings.

### How Webapp Consumes Contracts

- Import types and enums from `@mma/contracts/{domain}` (subpath imports — Golden Rule #11).
- API clients use Zod schemas from contracts to parse responses (`schema.parse(json)`).
- Status enums from contracts drive badge variant mappings and filter dropdowns.
- `next.config.js` lists workspace packages in `transpilePackages` so they are compiled by Next.js.

---

## 8.1 Mobile Architecture (Expo / React Native)

### Mobile Layering

```
Screen (apps/mobile/src/app/{domain}/)
  -> Domain Components (apps/mobile/src/components/{domain}/)
    -> React Query Hooks (packages/client-common/src/hooks/)        ← SHARED with webapp
      -> API Clients (packages/client-common/src/infrastructure/)   ← SHARED with webapp
        -> Backend REST APIs
```

**Dependency rule:** Screens import components and hooks. Components import hooks and mobile-ui primitives. The data-access layer (`client-common`) is shared with the webapp — hooks and API clients are written once.

### Package Responsibilities

| Package                 | Purpose                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@mma/mobile-ui`     | React Native primitives (Badge, Button, Card, Text, Input, Separator) + design tokens (`colors`, `spacing`, `radii`, `fontSizes`). No domain logic. See `mobile-ui-primitive` skill. |
| `@mma/client-common` | Framework-agnostic API clients + React Query hooks. **Shared by webapp and mobile.** See `webapp-api-client-hooks` skill.                                                            |
| `apps/mobile`           | Expo Router shell, screen orchestrators, domain-scoped RN components, status-variant mapping. See `mobile-new-screen` skill.                                                         |

### Routing (Expo Router)

- **File-based routing:** `apps/mobile/src/app/` — each `.tsx` file is a route.
- **Tabs:** `(tabs)/` folder contains the bottom tab navigator screens.
- **Detail screens:** `{domain}/[{entity}Id].tsx` uses dynamic route segments.
- **Root layout:** `_layout.tsx` provides `SafeAreaProvider`, `QueryClientProvider`, and `configureApi()`.

### Component Conventions

- **Domain-scoped folders:** `apps/mobile/src/components/{domain}/` (e.g., `users/`, `orders/`, `products/`).
- All components use `@mma/mobile-ui` primitives — never raw `View`/`Text` for interactive or styled elements.
- Lists use `FlatList` (never `ScrollView` + `map()`).
- **Status badge variants** are mapped in `apps/mobile/src/lib/status-variants.ts` using enum constants from `@mma/contracts/{domain}`.
- Styles use `StyleSheet.create()` at the bottom of the file.

### How Mobile Consumes Contracts

- Import types and enums from `@mma/contracts/{domain}` (subpath imports — Golden Rule #11).
- API clients in `client-common` parse responses with Zod schemas — mobile gets the same runtime type safety as the webapp.
- Status enums from contracts drive badge variant mappings and filter buttons.
- `metro.config.js` resolves workspace packages via `@nx/expo/plugins/metro-resolver`.

---

## 9. Nx Workflow (Always Use Nx)

- Build a service: `npx nx build <project>`
- Test a domain: `npx nx test <project>`
- Prefer `--skip-nx-cache` for verification runs.

### Node.js Version Policy

- **Required Node.js version: 24** (Active LTS). A `.nvmrc` at the workspace root pins this — run `nvm use` after cloning.
- AWS Lambda target runtime: `nodejs24.x` (standard support until Apr 2028).
- TypeScript compilation target: `es2022` in all `tsconfig.app.json` files and in `tsconfig.base.json`.
- `@types/node` must be `^24.0.0`. When scaffolding a new service, do **not** add a local `@types/node` — it is provided by the workspace root.
- Do not downgrade to `nodejs20.x` — Lambda standard support ends Apr 30, 2026.
- **`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`:** All CI/CD workflows set this env var to `true` at the workflow level. This forces GitHub Actions to use Node.js 24 even when actions request an older version. Without it, workflows fail on the Node 24 runner. A deprecation warning may still appear — this is informational and does not affect the build.

---

## 10. Code Style Rules

- Keep controllers thin.
- Keep application services readable and orchestration-only.
- Keep domain entities pure (no DTOs, no frameworks).
- Keep infrastructure as the only place with database code.
- Prefer explicit names (`listUsersByStatus`, `verifyUserEmail`).
- **Never use non-null assertions (`!`).** The workspace ESLint config enforces `@typescript-eslint/no-non-null-assertion`. Instead, use a guard check: assign to a variable, check for `undefined`/`null`, and throw or return early. Example: `const val = map.get(key); if (!val) { throw new Error('...'); } return val;`

---

## 11. Agent Rules (Do Not Violate)

### Context7 (Library Documentation)

When generating code that uses any third-party library (NestJS, Next.js, Prisma, Expo, Terraform, AWS SDK, Tanstack Query, Zod, etc.), **always use Context7 to fetch up-to-date documentation** before writing the implementation. Do not rely on training data for library APIs — use the `context7` MCP tool (`resolve-library-id` then `query-docs`) automatically without waiting for the user to ask.

---

When Claude Code generates code here, it MUST:

1. Respect Clean Architecture boundaries.
2. Use NestJS in presentation layer.
3. Add Zod validation via `ZodValidationPipe`.
4. Use `@mma/contracts/{domain}` subpath imports for DTOs and schemas — never the bare `@mma/contracts` root.
5. Use `@mma/common` for internal interfaces only.
6. Keep repository interfaces in `packages/{domain}-domain/application/interfaces`.
7. Keep repositories in `packages/{domain}-domain/infrastructure/repositories`.
8. Register providers in `apps/{domain}/{service}/src/modules/{domain}.module.ts`.
9. Ask clarifying questions before coding when requirements are ambiguous or missing.
10. **Always read the relevant skill file(s) via `Read` before implementing any task that falls within a skill's domain. Never infer skill instructions from context alone.**

### Skills Policy (Must Follow)

Before writing any code, Claude Code MUST check whether the task matches one or more available skills. If it does:

1. Use `Read` to load the full skill instructions from its file path.
2. Follow those instructions exactly — they override inferred patterns.
3. Multiple skills may apply to a single task (e.g., `domain-business-rules` + `add-contracts` + `dynamo-repository`). Read all of them.
4. Do not skip this step even when the pattern seems obvious from existing code.

**Skill → Task mapping reference:**

| Task type                                                                                                                                          | Skill(s) to read                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Adding status, transitions, invariants, guards to a domain entity                                                                                  | `domain-business-rules`                                                           |
| Creating a new domain entity class                                                                                                                 | `new-domain-entity`                                                               |
| Scaffolding a full new domain package                                                                                                              | `new-domain-package`                                                              |
| Adding a new use case                                                                                                                              | `new-use-case`                                                                    |
| Adding/updating contracts (Zod schemas, types)                                                                                                     | `add-contracts`                                                                   |
| Adding a new REST endpoint or reviewing routes                                                                                                     | `add-api-endpoints`                                                               |
| Adding a feature to an existing domain/service                                                                                                     | `add-feature-existing-domain`                                                     |
| Adding or updating Swagger/OpenAPI docs on a controller                                                                                            | `swagger-controller-docs`                                                         |
| Implementing or extending `DomainExceptionFilter`                                                                                                  | `domain-exception-filter`                                                         |
| Implementing the auth service (sign-in, refresh, password flows, JWT guard)                                                                        | `auth-api-service`                                                                |
| Adding file uploads or downloads via S3 presigned URLs                                                                                             | `file-upload-s3`                                                                  |
| Creating or modifying a DynamoDB repository                                                                                                        | `dynamo-repository`                                                               |
| Creating or modifying a Prisma repository                                                                                                          | `prisma-repository`                                                               |
| Creating a DynamoDB OneTable schema                                                                                                                | `new-dynamo-schema`                                                               |
| Creating a Prisma schema                                                                                                                           | `new-prisma-schema`                                                               |
| Scaffolding NestJS service layers (app service, controller, pipes, filters, module)                                                                | `nestjs-service-layers`                                                           |
| Wiring Prisma in a NestJS module (PrismaConfig, PRISMA_CLIENT token)                                                                               | `prisma-service-wiring`                                                           |
| Registering a new NestJS microservice in the Nx workspace                                                                                          | `nx-microservice-scaffold`                                                        |
| Scaffolding an SQS event-driven consumer service                                                                                                   | `sqs-event-driven-service`                                                        |
| Implementing event type constants, per-event payloads, or discriminated union Zod schemas for an SQS service                                       | `sqs-event-driven-service`                                                        |
| Publishing domain events to an SQS queue from an HTTP API service                                                                                  | `sqs-event-publisher`                                                             |
| Adding a synchronous HTTP call to another bounded context (ACL pattern)                                                                            | `sync-cross-service-call`                                                         |
| Consuming SQS events published by a different bounded context                                                                                      | `cross-domain-event-handler`                                                      |
| Adding cross-service validation to a use case (ACL dependency injection)                                                                           | `sync-cross-service-call` + `new-use-case`                                        |
| Implementing a choreography saga (multi-step async validation across domains)                                                                      | `choreography-saga`                                                               |
| Writing domain entity, use case, or application service tests                                                                                      | `write-domain-tests`                                                              |
| Writing backend event handler or ACL client tests                                                                                                  | `write-domain-tests`                                                              |
| Writing webapp component or utility tests                                                                                                          | `write-webapp-tests`                                                              |
| Writing mobile screen or component tests                                                                                                           | `write-mobile-tests`                                                              |
| Writing client-common API client, hook, or config tests                                                                                            | `write-client-common-tests`                                                       |
| Bootstrapping Swagger in `main.ts`                                                                                                                 | `swagger-controller-docs`                                                         |
| Generating or updating `.env.local` / `.env.local.example` from the codebase                                                                       | `generate-env-local`                                                              |
| Importing contracts in a service, reviewing contract import paths                                                                                  | `contracts-subpath-imports`                                                       |
| Adding a new domain's contracts package                                                                                                            | `contracts-subpath-imports` + `add-contracts`                                     |
| Adding a new webapp page or domain component                                                                                                       | `webapp-new-page`                                                                 |
| Adding or extending API clients and React Query hooks for a domain                                                                                 | `webapp-api-client-hooks`                                                         |
| Adding a new shared UI primitive to `@mma/ui`                                                                                                   | `webapp-ui-primitive`                                                             |
| Wrapping a Radix UI primitive (Dialog, DropdownMenu, Tooltip, Popover, Tabs, AlertDialog, Sheet, Command, etc.) in `@mma/ui`                    | `webapp-radix-primitive-wrap`                                                     |
| Adding or maintaining the Edge auth middleware / `oldst.session` marker cookie                                                                     | `webapp-auth-middleware` (SSR mode only)                                          |
| Adding a sortable / selectable / column-toggleable table via `<DataTable>`                                                                         | `webapp-data-table`                                                               |
| Adding cursor-paginated infinite scroll (users / products)                                                                                         | `webapp-cursor-infinite-scroll`                                                   |
| Applying optimistic updates to React Query mutations (status toggles, favorites)                                                                   | `webapp-optimistic-mutations`                                                     |
| Adding direct-to-S3 file upload UX in the webapp (FileDropzone + useFileUpload)                                                                    | `webapp-file-upload-ux`                                                           |
| Building a webapp form with `react-hook-form` + Zod resolver, reusing contract schemas                                                             | `webapp-form-with-validation`                                                     |
| Adding `error.tsx`, `loading.tsx`, `not-found.tsx`, or `global-error.tsx` to the webapp App Router                                                 | `webapp-error-boundaries`                                                         |
| Wiring toast notifications via `sonner` for mutation feedback                                                                                      | `webapp-toast-notifications`                                                      |
| Building skeleton loaders (`<TableSkeleton>`, domain detail skeletons) for webapp loading states                                                   | `webapp-skeleton-loading`                                                         |
| Adding, changing, or auditing cross-platform design tokens (colors, spacing, radii, typography)                                                    | `fe-design-tokens`                                                                |
| Wiring or modifying webapp dark mode (`next-themes`, `.dark` CSS overrides, `<ThemeToggle>`)                                                       | `webapp-dark-mode`                                                                |
| Running an accessibility pass / fixing axe violations / adding a page to the a11y scan                                                             | `fe-accessibility-audit`                                                          |
| Investigating bundle size, adding a heavy dependency, performance profiling the webapp                                                             | `fe-performance-bundle-analysis`                                                  |
| Adding a full-stack feature (backend + webapp) to an existing domain                                                                               | `add-feature-existing-domain` (includes webapp touchpoints)                       |
| Adding a new mobile screen or domain component                                                                                                     | `mobile-new-screen`                                                               |
| Adding a new shared UI primitive to `@mma/mobile-ui`                                                                                            | `mobile-ui-primitive`                                                             |
| Adding a mobile feature that surfaces an existing backend capability                                                                               | `mobile-new-domain-feature`                                                       |
| Configuring EAS Build / EAS Update profiles, channels, runtime version, app.config.ts                                                              | `mobile-eas-build-update`                                                         |
| Triggering a mobile release (OTA, native build, store submission) via `cd-mobile-deploy.yml`                                                       | `mobile-cd-pipeline`                                                              |
| Wiring `expo-secure-store` and the `TokenStorage` adapter for mobile auth persistence                                                              | `mobile-secure-storage-auth`                                                      |
| Adding Sentry error tracking, sourcemap upload, or per-screen `<ErrorBoundary>` to mobile                                                          | `mobile-error-boundary-sentry`                                                    |
| Replacing mobile branding (icon, adaptive icon, splash) or adjusting splash behaviour                                                              | `mobile-app-icon-splash`                                                          |
| Configuring mobile deep links (custom scheme + Universal Links / App Links)                                                                        | `mobile-deep-linking`                                                             |
| Building a mobile form with react-hook-form + Zod (Controller pattern, KeyboardAvoidingView, password fields)                                      | `mobile-form-with-validation`                                                     |
| Building mobile auth screens (login, forgot password, confirm reset, new password)                                                                 | `mobile-auth-screens`                                                             |
| Configuring Expo Router navigation (tabs, stacks, auth guard, modals, route params)                                                                | `mobile-navigation-patterns`                                                      |
| Adding push notifications end-to-end (mobile + backend domain + dispatcher)                                                                        | `mobile-push-notifications` (planning) + `add-push-notifications` workflow prompt |
| Adding a full-stack feature (backend + webapp + mobile) to an existing domain                                                                      | `add-feature-existing-domain` (includes webapp Step 11 + mobile Step 12)          |
| Writing API E2E tests for a backend service                                                                                                        | `write-api-e2e-tests`                                                             |
| Writing Playwright E2E tests for the webapp                                                                                                        | `write-webapp-e2e-tests`                                                          |
| Adding E2E infrastructure (tables, databases, queues) for a new domain                                                                             | `e2e-infrastructure`                                                              |
| Registering a new service in the CD pipeline (Terraform + service-registry.json)                                                                   | `cd-register-service`                                                             |
| Adding infrastructure resources (DynamoDB table, SQS queue, RDS PostgreSQL DB, S3 bucket) to Terraform                                             | `cd-register-service`                                                             |
| Creating or managing preview environments                                                                                                          | `cd-register-service`                                                             |
| Adding a one-shot deploy task (Prisma migration, seed script, custom initialization)                                                               | `init-runner-deploy-task`                                                         |
| Creating a new Terraform child module for a new AWS service type (ElastiCache, SES, Kinesis, etc.)                                                 | `infra-new-module`                                                                |
| Wiring CloudWatch alarms or structured logging (`createLogger`) to a new service                                                                   | `add-monitoring`                                                                  |
| Adding correlationId propagation to a new service (middleware, event handler, SQS publisher)                                                       | `add-monitoring` + `sqs-event-driven-service`                                     |
| Adding a new notification channel (PagerDuty, Opsgenie, Teams, additional Slack workspace, etc.)                                                   | `add-notifications`                                                               |
| Adding or wiring a Lambda Function URL (public HTTPS endpoint without API Gateway)                                                                 | `lambda-function-url`                                                             |
| Extending the internal monitoring tool with a new endpoint, view, or AWS data source                                                               | `extend-monitoring-service`                                                       |
| Configuring or troubleshooting AWS X-Ray tracing on a backend service                                                                              | `xray-adot-setup`                                                                 |
| Adding a new structural coding standards check to lint-standards.ts                                                                                | `add-structural-lint-check`                                                       |
| Diagnosing local development failures (LocalStack, Prisma engine, ports, SQS URLs, node version)                                                   | `debug-local-dev`                                                                 |
| Reading the authenticated actor in a controller, adding `@CurrentUser()` to a new endpoint                                                         | `current-user-decorator`                                                          |
| Wiring API Gateway JWT authorizer, declaring public routes in `service-registry.json`, two-tier (gateway + NestJS) auth                            | `gateway-jwt-auth`                                                                |
| Configuring CloudFront — webapp custom domain, signed-URL S3 downloads, cache behavior                                                             | `cloudfront-cdn`                                                                  |
| Validating Terraform changes — fmt / validate / tflint / plan inspection / module smoke tests                                                      | `write-infra-tests`                                                               |
| Scaffolding the backend `notification-domain` package + dispatcher service (push notifications)                                                    | `notification-domain`                                                             |
| Rotating AWS Secrets Manager secrets (DB passwords, JWT keys, third-party tokens)                                                                  | `secrets-rotation`                                                                |
| Seeding local LocalStack / Postgres with realistic dev data for the webapp / mobile app                                                            | `local-seed-data`                                                                 |
| Generating a Figma page/frame from a brief / page spec / live webapp route using `@mma/ui` library components (reverse of `figma-to-ui-screen`) | `ui-to-figma-page`                                                                |

### Workflow Orchestrators (Guided Prompts)

The template ships workflow orchestrator prompts in `.claude/commands/`. These activate automatically when the user describes a matching composite task. They guide the user through a structured interview, plan execution phases, load the correct skills in order, and validate between phases.

#### Three-Tier Agent Architecture

The orchestrator prompts sit on top of a three-tier agent model documented in `docs/AGENT_ARCHITECTURE.md` and catalogued in `docs/agents-catalog.md`. Tiers:

1. **Router** (`orchestrator-router.md`) — recommend-only intent classifier. **Never auto-dispatches.** Invoke when the user's request is ambiguous and you need to pick the right `/...` prompt. Output is a single `STATUS:` line — the developer (or you) then runs the prompt.
2. **Orchestrator prompts** (`.claude/commands/*.md`) — the workflows below. Each one spawns subagents during its phases.
3. **Subagents** (`.claude/agents/*.md`) — single-purpose, context-isolated workers invoked via `Agent(name, prompt)`. Categories: Discovery (read-only research), Build (scoped writes inside one layer), Validation (read-only audits — including `security-reviewer`), Aggregation (`result-aggregator` composes N subagent reports into one digest), Operations (e.g. `pr-summary-writer` drafts PR copy from a diff).

Canonical tool mapping for `Agent(name, prompt)` is fixed by ADR-007 (`docs/decisions/007-runsubagent-tool-mapping.md`) — `name` resolves to `.claude/agents/{name}.md`. Drift is prevented by the `agent-frontmatter-required` and `Agent-reference-resolves` structural lint checks.

#### Available Workflows

| Prompt file                         | Triggers on                                                                                                                                                            | Skills orchestrated                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new-domain.md`              | "add a domain", "new bounded context", "scaffold a domain"                                                                                                             | 8+ skills across domain + contracts + service + infra                                                                                                                                     |
| `new-feature.md`             | "add a feature", "add endpoint", "extend the domain"                                                                                                                   | 6–8 skills, skipping unchanged layers                                                                                                                                                     |
| `new-service.md`             | "add a microservice", "new API service", "new event handler"                                                                                                           | 3 skills for Nx scaffold + layers + infra                                                                                                                                                 |
| `full-stack-feature.md`      | "full-stack feature", "backend + frontend", "end to end"                                                                                                               | 10+ skills across all layers                                                                                                                                                              |
| `new-event-service.md`       | "publish events", "event handler", "saga", "async communication"                                                                                                       | 2–6 skills depending on pattern                                                                                                                                                           |
| `new-e2e-tests.md`           | "add e2e tests", "playwright tests", "api e2e", "write e2e"                                                                                                            | 3 skills: e2e-infrastructure → write-api-e2e-tests → write-webapp-e2e-tests                                                                                                               |
| `webapp-feature.md`          | "add a webapp page", "new admin page", "add a UI for", "create a page that"                                                                                            | 6–10 webapp skills (hooks, primitives, page, form, error/loading, toast, tests, e2e)                                                                                                      |
| `mobile-release.md`          | "ship the mobile app", "release mobile", "mobile build", "mobile OTA", "submit to app store"                                                                           | 5 mobile skills + EAS workflow trigger                                                                                                                                                    |
| `add-push-notifications.md`  | "add push notifications", "send push to mobile", "order status push", "notification service"                                                                           | 6+ skills (notification domain + dispatcher + mobile + infra), planning-first                                                                                                             |
| `fe-accessibility-pass.md`   | "a11y audit", "fix accessibility", "axe violations", "accessibility pass"                                                                                              | 1 skill (`fe-accessibility-audit`) + targeted UI/component fixes                                                                                                                          |
| `new-ui-primitive.md`        | "new ui primitive", "shared component web and mobile", "design system component"                                                                                       | `fe-design-tokens` + `webapp-ui-primitive` (or radix-wrap) + `mobile-ui-primitive`                                                                                                        |
| `new-domain-dynamo.md`       | "new dynamodb domain", "add a dynamo-backed domain" — fast path that hard-codes `persistence=dynamodb`                                                                 | Same as `/new-domain` minus the persistence-decision question                                                                                                                             |
| `quick-crud-domain.md`       | "quick crud domain", "simple crud domain", "basic crud entity" — minimum-viable scaffold (no business-rule interview)                                                  | `new-domain-package` + `add-contracts` + `nestjs-service-layers` (skips `domain-business-rules`)                                                                                          |
| `new-use-case.md`            | "add a use case", "add an action to", "cancel use case", "list X by Y" — single use case via `@mma/nx-plugin:use-case`                                              | `new-use-case`                                                                                                                                                                            |
| `add-monitoring-feature.md`  | "add to monitoring tool", "extend monitoring dashboard", "new monitoring page"                                                                                         | `extend-monitoring-service`                                                                                                                                                               |
| `add-alerting.md`            | "add alerting", "PagerDuty", "Opsgenie", "Slack alerts", "on-call notifications", "wire up alarms"                                                                     | `add-notifications` (new channel) OR `add-monitoring` (wire existing service to alarms)                                                                                                   |
| `figma-component.md`         | "build this Figma component", "generate from this Figma URL" (single component), "translate this Figma node"                                                           | `figma-to-ui-component` + `webapp-ui-primitive` (or `webapp-radix-primitive-wrap`) + optionally `mobile-ui-primitive` + `fe-design-tokens`                                                |
| `figma-page.md`              | "port this Figma dashboard", "build this Figma screen", "generate page from this Figma URL"                                                                            | `figma-to-ui-screen` + `webapp-new-page` + recursive `/figma-component` for missing primitives + `webapp-form-with-validation` + `webapp-error-boundaries` + `webapp-toast-notifications` |
| `figma-import.md`            | "import this Figma file", "bootstrap from this Figma URL", "generate everything from Figma"                                                                            | All Figma + UI + page skills, classification-driven, two-phase plan-then-execute                                                                                                          |
| `ui-to-figma-page.md`        | "build this page in Figma using our components", "draft a Figma mock from this spec", "mirror the /users page back into Figma" (reverse direction — code/spec → Figma) | `ui-to-figma-page` + `parse-page-spec` (Mode B) + recursive `figma-to-ui-component` for missing primitives                                                                                |
| `generate-source-stories.md` | "generate stories for this repo", "add storybook stories", "source has no stories", "enrich storybook before migration"                                                | Analyzes source component `.tsx` files + feature usage → writes `.stories.tsx` for every component. Run before `/migrate-extract` when source has no or sparse Storybook coverage.        |
| `migrate-extract.md`         | "migrate this project", "extract from the source repo", "analyse the legacy app"                                                                                       | Read-only discovery + analysis subagents → produces analysis cards under `{migrationRoot}/`                                                                                               |
| `migrate-to-specs.md`        | "turn the cards into specs", "generate the migration specs", "specs from extraction"                                                                                   | `domain-spec-writer` + `page-spec-writer` → `.specs/domain-*.yaml` + `page-*.yaml` (translator, two-phase plan→execute)                                                           |
| `migrate-build-ui.md`        | "build the migration UI", "build the primitives", "build the composites"                                                                                               | `ui-primitive-builder` + `composite-builder` + `story-parity-auditor` (hard-fail story-matrix gate) + `coverage-auditor` — primitives + composites only (no pages, no backend)            |
| `migrate-page.md`            | "build the migration page", "build the projects page (mock)", "wire the page to the API"                                                                               | `migration-page-builder` — builds a page once in `(protected)/{route}/` with a swappable `_data/{domain}.adapter.ts` (`--mock` → `--wire`)                                                |

#### Migration Workflow Selector — The 4-Step Build-Once Flow

The migration prompts run in order. Pages build **once** in their real `(protected)/{route}/` location — there is no separate preview surface to promote. See [docs/MIGRATION_WORKFLOW_GUIDE.md](MIGRATION_WORKFLOW_GUIDE.md).

| Step | Prompt              | Output                                                                                                                                                                                                                                                                       |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `/migrate-extract`  | Analysis cards (domains, routes, components, tokens) under `{migrationRoot}/`                                                                                                                                                                                                |
| 2    | `/migrate-to-specs` | `.specs/domain-*.yaml` + `page-*.yaml` (translated from cards)                                                                                                                                                                                                       |
| 3    | `/migrate-build-ui` | `@mma/ui` primitives + prop-driven `components/{domain}/` composites; a hard-fail **story-parity gate** (`story-parity-auditor` → `components/STORY_PARITY.md`) proves every source Storybook variant/state is demonstrated in the target or carries a recorded transform |
| 4    | `/migrate-page`     | Page built once in `(protected)/{route}/`; `--mock` interactive fixture adapter → `--wire` real `@mma/client-common` hooks. Toggled locally via `NEXT_PUBLIC_MOCK_PREVIEW=true` + `NEXT_PUBLIC_STAGE=local` (UX-only auth bypass, code never removed).                    |

#### Domain Workflow Selector — Which `/new-domain` Variant?

Three prompts can scaffold a domain. Pick the most specific:

| User intent                                                                                 | Prompt                        |
| ------------------------------------------------------------------------------------------- | ----------------------------- |
| Plain CRUD, no business rules, fastest path                                                 | `quick-crud-domain.md` |
| DynamoDB-only, skip the persistence question, full interview otherwise                      | `new-domain-dynamo.md` |
| Default — full interview including persistence (DynamoDB or Prisma), business rules, events | `new-domain.md`        |

#### Figma Workflow Selector — Which Figma Prompt?

Four prompts handle Figma workflows. Pick by direction + scope:

| Direction    | User intent                                                                                                            | Prompt                       | Output scope                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Figma → code | One specific component (Button, Toast, Switch) from a Figma URL                                                        | `figma-component.md`  | 1 file in `@mma/ui` (+ optional mobile mirror)                                                              |
| Figma → code | One screen / dashboard from a Figma URL                                                                                | `figma-page.md`       | 1 page + N domain components in `apps/webapp/` (recursively invokes `/figma-component` for missing primitives) |
| Figma → code | Bulk import — whole Figma file or page, AI classifies design-system vs page-local                                      | `figma-import.md`     | M primitives + N pages + components, two-phase plan-then-execute with explicit approval gate                   |
| code → Figma | Designer wants a Figma frame built from a brief, page spec, or live route — composed of `@mma/ui` library instances | `ui-to-figma-page.md` | 1 Figma frame (per theme/viewport) in a designer-supplied file                                                 |

> **Note:** Figma Code Connect (mapping `@mma/ui` primitives to Figma master components so Dev Mode returns real imports) is **not supported on Figma Professional or below** — it requires Organization/Enterprise. The orchestrator, skill, and CI workflow have been removed from this template. If your team upgrades, re-introduce them or wire `@figma/code-connect` manually following the official docs.

#### Orchestrator Design Rules

1. **Interview before code.** Orchestrators MUST collect all required information before loading any skill or writing any file.
2. **Phase validation.** After each phase, run `Bash` on affected files. Fix errors before proceeding.
3. **Skill loading is lazy.** Only read a skill's SKILL.md when its phase is about to execute — not at the start.
4. **Users can exit mid-workflow.** Each phase produces valid, compilable code. Partial completion is acceptable.
5. **Final verification.** Every orchestrator ends with `nx test` + `nx build` for all affected projects.
6. **Orchestrators compose skills.** They do not replace individual skills — skills remain the authoritative source for single-layer patterns.

### Ambiguity Policy (Must Follow)

If any of the following are unclear, ask the user before proceeding:

- Domain name, entity name, or service name.
- Persistence requirements (table name, index patterns, or required attributes).
- API routes and HTTP verbs.
- Which DTOs/contracts are needed for input/output.
- Whether pagination or filters are required.
- Any business rules or invariants for the entity.
- Whether the feature requires cross-service validation (sync) or event-driven communication (async).

---

## 12. Testing Expectations

### Coverage Thresholds

| Project type    | Threshold                                    | Examples                                          |
| --------------- | -------------------------------------------- | ------------------------------------------------- |
| Domain packages | 80% (branches, functions, lines, statements) | `user-domain`, `order-domain`, `product-domain`   |
| Service apps    | 70%                                          | `user-api-service`, `order-event-handler-service` |
| Frontend apps   | 70%                                          | `webapp`, `mobile`                                |
| Shared packages | 70%                                          | `client-common`                                   |
| E2E projects    | No coverage threshold                        | `user-api-service-e2e`, `webapp-e2e`              |

### What Gets Tested

- **Domain entities**: unit tests for `create()`, `reconstitute()`, every business method, every invariant.
- **Use cases**: unit tests with mocked repositories (and mocked ACL validators where applicable).
- **Application services**: unit tests with mocked use cases + mocked `IEventPublisher`. Test cursor routing (DynamoDB) and DTO transformation.
- **Event handler services**: unit tests for dispatcher logic (event type routing, Zod safeParse) and individual handler functions (delegation, idempotency guards for saga events).
- **ACL clients** (infrastructure): unit tests with mocked `HttpService`, testing HTTP error mapping to domain exceptions.
- **API clients** (`client-common`): unit tests mocking `globalThis.fetch`, verifying URL construction, HTTP method, body, and Zod schema parsing.
- **React Query hooks** (`client-common`): unit tests using `renderHook` + `QueryClientProvider` wrapper, verifying query keys, enabled flags, and mutation calls.
- **Webapp components**: component tests for domain tables (rows, badges, empty state, links), action components (conditional buttons by status), and status-variant pure functions.
- **Mobile components**: component tests for domain lists (FlatList items, navigation on press, loading/empty states) and detail screens (conditional action buttons by status, mutation calls).
- **API E2E tests**: full HTTP request/response cycle against running backend services with real infrastructure (DynamoDB, Postgres, SQS). Test CRUD operations, status transitions, validation errors, cross-domain interactions, and pagination.
- **Webapp E2E tests**: Playwright browser tests against the running webapp + backend services. Test user flows end-to-end: navigation, CRUD forms, status transitions, data display, cross-domain workflows.

### Test File Location

- **Backend**: Co-located — `.spec.ts` next to source file.
- **Webapp**: Co-located — `.spec.tsx` next to source file.
- **Mobile**: Co-located — `.spec.tsx` next to source file (e.g. `src/components/users/users-list.tsx` → `src/components/users/users-list.spec.tsx`). See the `write-mobile-tests` skill.
- **client-common**: Co-located — `.spec.ts` / `.spec.tsx` next to source file.
- **API E2E**: `apps/{domain}/{service}-e2e/src/` — one spec file per endpoint group.
- **Webapp E2E**: `apps/webapp-e2e/src/specs/{domain}/` — one spec file per domain flow.

### When Tests Are Required

- Domain entities and use cases: always.
- Application services: always (they all have orchestration logic — cursor routing, DTO mapping, event publishing).
- Event handler services: always (dispatcher + each handler).
- Webapp/Mobile components: when they contain conditional rendering logic (status-dependent buttons, data-driven tables). Thin pages are optional.
- `client-common`: API clients and hooks always. Config and error class once.
- API E2E: when adding a new API service, or when new endpoints affect critical user flows.
- Webapp E2E: when adding a new domain page, or when new features affect critical browser-based user flows.

If an application service does more than pass-through, tests are required.

---

## 13. E2E Testing

### Strategy

E2E tests validate the full vertical slice — from HTTP request (API E2E) or browser interaction (Webapp E2E) through the entire stack to the real database and back. They complement unit/integration tests by catching wiring issues, serialization bugs, and cross-service integration problems that mocked tests cannot detect.

### Test Pyramid Distribution

| Layer                                          | Coverage | Purpose                                          |
| ---------------------------------------------- | -------- | ------------------------------------------------ |
| Unit tests (domain entities, use cases)        | ~70%     | Business logic, invariants, edge cases           |
| Integration tests (app services, repositories) | ~20%     | DTO mapping, cursor routing, persistence         |
| API E2E tests (backend services)               | ~5%      | Full HTTP CRUD, status transitions, cross-domain |
| Webapp E2E tests (Playwright)                  | ~5%      | Critical user flows, navigation, forms           |

### Data Isolation

E2E tests use **dedicated infrastructure** to avoid polluting development data:

| Resource          | Dev value                                       | E2E value                                                   |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| DynamoDB tables   | `OldSTTable`                                    | `OldSTTable_E2E_Users`, `OldSTTable_E2E_Products`           |
| Postgres database | `orders_db`                                     | `orders_e2e_db`                                             |
| SQS queues        | `user-events`, `product-events`, `order-events` | `user-events-e2e`, `product-events-e2e`, `order-events-e2e` |

All E2E infrastructure is created by `scripts/setup-e2e.ts` and torn down by `scripts/teardown-e2e.ts`. Environment variables are defined in `.env.e2e.example` (gitignored `.env.e2e` for local overrides).

### Project Structure

```
apps/
  users/
    user-api-service-e2e/       ← API E2E tests for user service
      src/
        support/
          global-setup.ts       ← runs setup-e2e.ts
          global-teardown.ts    ← runs teardown-e2e.ts
          test-setup.ts         ← per-file setup (data cleanup)
        user-crud.spec.ts
        user-status-transitions.spec.ts
  products/
    product-api-service-e2e/    ← API E2E tests for product service
  orders/
    order-api-service-e2e/      ← API E2E tests for order service
  webapp-e2e/                   ← Playwright browser E2E tests
    src/
      fixtures/
        base.fixture.ts         ← test fixture with shared context
      page-objects/
        {domain}-list.page.ts
        {domain}-detail.page.ts
      specs/
        users/
        products/
        orders/
      utils/
        selectors.ts            ← data-testid constants
```

### Running E2E Tests

```bash
# API E2E (requires running backend services + infrastructure)
pnpm nx e2e user-api-service-e2e
pnpm nx e2e product-api-service-e2e
pnpm nx e2e order-api-service-e2e

# Webapp E2E (requires running webapp + backend services + infrastructure)
pnpm nx e2e webapp-e2e

# All E2E via VS Code tasks:
# "E2E: Run API E2E Tests" or "E2E: Run Webapp E2E Tests"
```

### What E2E Tests Cover

- **API E2E**: CRUD operations, input validation (400 responses), not-found (404), conflict errors (409), status transitions, pagination, cross-domain interactions (e.g., order creation validates user/product), event-driven side effects.
- **Webapp E2E**: Page navigation, table rendering with correct data, create/edit forms with validation, status badge display, action buttons (conditional by status), cross-domain links, filter/search functionality.

### CI Integration

E2E tests run in GitHub Actions via `.github/workflows/ci-e2e.yml` with dedicated service containers (LocalStack + Postgres). API E2E runs first; Webapp E2E runs after API E2E passes. Playwright reports and test artifacts are uploaded on failure.

---

## 14. Continuous Deployment Architecture

### Deployment Model

- **Backend services** deploy as **Lambda ZIP packages** (not Docker containers). Each service's `main.ts` runs a plain NestJS HTTP server on `PORT` (default 8080). **AWS Lambda Web Adapter** (a public Lambda layer) proxies Lambda invocation events to the HTTP server — no `@codegenie/serverless-express` or dual-mode `handler` export. The Lambda handler is `run.sh` (a shell script that runs `exec node main.js`). Locally (`STAGE=local`), the same `bootstrap()` function runs directly via `node main.ts`.
- **Shared API Gateway:** All API services share a **single API Gateway HTTP API v2** per environment. Each Lambda is wired to a path-based route: `ANY /{domain}/{proxy+}`. Lambda Web Adapter's `AWS_LWA_REMOVE_BASE_PATH=/{domain}` env var strips the `/{domain}` prefix before forwarding to NestJS, so NestJS only sees `/api/{resource}`. The `domain` value comes from the service's `domain` field in `service-registry.json`.
- **Edge Auth (Two-Tier JWT):** Every API service request is authenticated **twice** — once at the edge (API Gateway HTTP API v2 JWT authorizer using Cognito JWKS) and once inside Lambda (NestJS `JwtAuthGuard`). The gateway-side check rejects unauthenticated requests with `401` before Lambda is invoked, eliminating cold-start cost for invalid traffic. Public routes (sign-in, /health, /swagger) are declared in `service-registry.json` → `gatewayAuth.publicRoutes` and Terraform creates per-route `authorization_type = "NONE"` overrides. The list MUST stay in sync with `@Public()` decorators — enforced by the `gateway-public-routes-sync` lint check. See the `gateway-jwt-auth` skill for the full model. Disable per-environment by setting `gatewayAuth.enabled = false` (preview only — never staging/prod).
- **Webapp** deploys as a **static Next.js export** (`output: 'export'`) to **S3 + CloudFront** for all environments. The CD workflow runs `pnpm nx build webapp` to produce `apps/webapp/out/`, syncs it to S3, and creates a CloudFront invalidation. There is no Docker build, no ECR push, and no ECS/Lambda resource for the main webapp. The `infra/modules/static-webapp` module creates a private S3 bucket + CloudFront distribution with OAC + SPA routing (403/404 → `/index.html`). The mode is configured per-environment in `service-registry.json` → `webapp.deploymentMode`; all environments default to `"static"`. Legacy `"lambda"` (Lambda container image via **Lambda Function URL**) and `"ecs"` (ECS Fargate + ALB) modes are available for teams that require SSR, but require adding a `Dockerfile` to `apps/webapp/` and switching `next.config.js` to `output: 'standalone'`.
- **Notifications** are managed by the `infra/modules/notifications` module — one SNS topic per environment, with email subscriptions and an AWS Chatbot Slack channel configuration. The CloudWatch alarms in `infra/modules/monitoring` publish to this topic. Configuration lives in `infra/notification-config.json` (see `docs/notifications.md`).
- **CDN / CloudFront** is split across two modules. `infra/modules/cloudfront-webapp` fronts the webapp origin (Lambda Function URL or ALB) with edge caching and provides the stable HTTPS attachment point for a custom domain (ACM + Route 53). `infra/modules/cloudfront-s3` fronts S3 buckets that opt-in via `cloudfront: true` in `service-registry.json` → `infrastructure.s3Buckets[]`, used for **signed-URL file downloads** (long expiry, edge-cached). Uploads still go directly to S3 via presigned PUT URLs — CloudFront is download-side only.
- **Infrastructure** is managed with **Terraform** — reusable child modules under `infra/modules/`, composed in environment root modules under `infra/environments/`.
- **Webpack output:** All service `webpack.config.js` files must include `libraryTarget: 'commonjs2'` in the `output` block. Without this, the Lambda runtime cannot resolve the module exports.
- **Lambda handler:** All API services use `run.sh` as the Lambda handler (not `main.handler`). The `run.sh` script runs `exec node main.js`. The CD workflow creates `run.sh` in the dist directory before zipping. Lambda Web Adapter proxies invocations to the HTTP server started by `main.js`.
- **Prisma engine verification:** Both CD workflows include a "Verify Prisma engine binaries" step after the build job. It checks that every `dist/` directory containing a `schema.prisma` also contains the `libquery_engine-rhel-openssl-3.0.x.so.node` binary. If any engine binary is missing, the step fails the pipeline before deployment.
- **Lambda ZIP packaging targets:** Every backend service's `project.json` must include `prune-lockfile`, `copy-workspace-modules`, and `prune` targets (see `nx-microservice-scaffold` skill). These targets strip the lockfile, copy only required workspace package manifests, and prune `node_modules` to production dependencies for the Lambda ZIP.
- **SQS startup validation:** Every NestJS module that depends on an SQS queue URL must validate the env var at module initialization. Use `onModuleInit()` to check that the URL is non-empty and throw a descriptive error if missing. This prevents silent failures where a service starts successfully but crashes on the first event publish.

### Data-Driven Terraform Pattern

All Terraform environment roots read `.github/service-registry.json` and create AWS resources via `for_each`. This means:

| Operation                                                      | Terraform file edits needed                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Add a new API/worker service                                   | **Zero** — add entry to `service-registry.json`                                                      |
| Add a new DynamoDB table                                       | **Zero** — add to `infrastructure.dynamodbTables`                                                    |
| Add a new SQS queue                                            | **Zero** — add to `infrastructure.sqsQueues`                                                         |
| Add a new S3 bucket                                            | **Zero** — add to `infrastructure.s3Buckets`                                                         |
| Add a new RDS PostgreSQL database                              | **Zero** — add to `infrastructure.rds`                                                               |
| Add env vars to a service                                      | **Zero** — add to the service's `envVars` array                                                      |
| Add a new NEXT*PUBLIC*\* var                                   | **Near-zero** — add to `webapp.envVars` + Dockerfile `ARG`/`ENV`                                     |
| Add a notification email or Slack channel                      | **Zero** — edit `infra/notification-config.json`                                                     |
| Introduce an entirely new AWS service type (e.g., ElastiCache) | **Requires new module** — create `infra/modules/{type}/` and add `module` block to environment roots |

### Directory Structure

```
infra/
  bootstrap/          ← One-time per-account: S3 state bucket, DynamoDB lock table, ECR, OIDC, IAM
  init-runner/        ← Lambda one-shot handler for deploy tasks (handler.mjs + entrypoint.mjs + scripts)
  modules/            ← Reusable child modules (networking, dynamodb, rds, sqs, s3, api-gateway,
                        lambda-api, lambda-worker, lambda-webapp, lambda-runner, webapp, secrets,
                        monitoring, notifications, cognito, cloudfront-webapp, cloudfront-s3)
  environments/       ← Root modules per environment
    dev/              ← terraform.tfvars with dev-specific settings
    staging/
    prod/
    preview/          ← Parameterized — state in S3 key: preview/{name}/terraform.tfstate
```

### CD Workflows

| Workflow                   | Trigger                                                    | Purpose                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd-deploy.yml`            | Push to `develop` → dev, `main` → staging, manual dispatch | Build affected services, Terraform apply, run init tasks (migrations/seeds), deploy Lambdas + webapp                                               |
| `cd-monitoring-deploy.yml` | Manual dispatch (per environment)                          | Build + deploy the internal monitoring tool (`monitoring-api-service` + `monitoring-webapp` Lambda container images) and apply its Terraform infra |
| `cd-preview-create.yml`    | Manual dispatch                                            | Create/update a full-stack preview environment                                                                                                     |
| `cd-preview-destroy.yml`   | Manual dispatch                                            | Tear down a preview environment                                                                                                                    |
| `cd-destroy.yml`           | Manual dispatch (double-confirm)                           | Permanently destroy an entire dev/staging/prod environment and all its AWS resources                                                               |
| `cd-infra-plan.yml`        | PR with `infra/**` or `service-registry.json` changes      | Run `terraform plan` for dev/staging/prod, post result as PR comment                                                                               |

### Bootstrap (One-Time Setup)

Before first deployment, run `infra/bootstrap/` locally to create:

- S3 bucket for Terraform state + DynamoDB lock table
- ECR repositories for webapp and monitoring-webapp Docker images
- GitHub OIDC provider + IAM deploy role + monitoring deploy role
- S3 artifact bucket for Lambda ZIP packages

**Single-account setup** (all environments in one AWS account):

```bash
cd infra/bootstrap
terraform init
terraform apply -var="project_name=myproject" -var="github_org=MyOrg" -var="github_repo=my-repo"
```

Then run the `AWS: Setup GitHub Repo Variables` VS Code task to set repo-level variables (`PROJECT_NAME`, `AWS_ACCOUNT_ID`, `AWS_REGION`, `ARTIFACT_BUCKET`, `ECR_REPO_URL`).

**Multi-account setup** (AWS best practice — one account per environment):

Run bootstrap once per target AWS account. The `environment` variable suffixes globally-unique resource names (S3 buckets) so they don't collide across accounts:

```bash
# In the DEV account:
cd infra/bootstrap
terraform init
terraform apply \
  -var="project_name=myproject" -var="environment=dev" \
  -var="github_org=MyOrg" -var="github_repo=my-repo"
# Run "AWS: Setup GitHub Env Variables" task → select "dev"

# In the STAGING account (switch AWS credentials first):
terraform init -reconfigure
terraform apply \
  -var="project_name=myproject" -var="environment=staging" \
  -var="github_org=MyOrg" -var="github_repo=my-repo"
# Run "AWS: Setup GitHub Env Variables" task → select "staging"

# In the PROD account:
terraform init -reconfigure
terraform apply \
  -var="project_name=myproject" -var="environment=prod" \
  -var="github_org=MyOrg" -var="github_repo=my-repo"
# Run "AWS: Setup GitHub Env Variables" task → select "prod"
```

Each `AWS: Setup GitHub Environment Variables` run **auto-creates** the GitHub environment (via `gh api PUT /repos/{owner}/{repo}/environments/{env}`) and then sets **environment-scoped** GitHub variables (`AWS_ACCOUNT_ID`, `AWS_REGION`, `ARTIFACT_BUCKET`, `ECR_REPO_URL`, `TFSTATE_BUCKET`, `TFSTATE_LOCK_TABLE`). Workflows use `environment:` on each job so `vars.*` resolves to the correct account automatically. The `PROJECT_NAME` repo variable stays shared. No manual environment creation in GitHub Settings is needed.

For single-account setups, the `environment` variable can be omitted — all resource names use `{project_name}` without a suffix, and repo-level variables work as before (full backward compatibility).

### Preview Environments

- Fully isolated per preview (own DynamoDB tables, RDS instance, SQS queues, Lambda functions, ECS service).
- State isolation via S3 key: `preview/{preview_name}/terraform.tfstate`.
- Reduced resource sizing (Lambda 256MB, RDS db.t4g.micro, ECS 256 CPU / 512 memory).
- No deletion protection — cleanup via `cd-preview-destroy.yml`.

### Structural Coding Standards (`scripts/lint-standards.ts`)

The workspace includes a structural linting tool that enforces codebase-wide conventions beyond what ESLint covers. It runs as part of `ci-fast-check.yml`. Configuration is in `coding-standards.config.ts` at the workspace root.

Current checks include:

- `entity-no-toObject` — Entities must not have `toObject()` methods.
- `entity-uses-enum-constants` — Entity methods must use enum constants, not string literals.
- `no-bare-contracts-import` — Imports must use subpath (`@mma/contracts/{domain}`).
- `no-createdAt-in-entities` — Entities use `dateCreated`, not `createdAt`.
- `no-node-env-development` — Code must check `STAGE`, not `NODE_ENV`, for local mode.
- `controller-no-direct-usecase` — Controllers must call application services, not use cases.
- `domain-no-nestjs-imports` — Domain layer must not import from `@nestjs/*`.
- `prisma-client-infra-only` — Only `infrastructure/repositories/` may import from `@prisma/client` or generated client paths.
- `service-registry-env-sync` — SQS/DynamoDB/database env vars in module code must be declared in both `service-registry.json` and `service-registry.env`.
- `app-service-has-logger` — Every application service must use `createLogger()` from `@mma/telemetry` as a module-level singleton (Golden Rule #35). Detects both missing loggers and forbidden `new Logger()` from `@nestjs/common`.
- `mutation-methods-have-actor-id` — Every mutation application service method (non-GET) must accept `actorId: string` and include it in `logger.info()` fields (Golden Rule #10a). Detects mutation methods that log `{ userId }` without `actorId`.
- `no-dynamic-tailwind-classes` — `className=` template literals containing `${...}` interpolation directly after a Tailwind prefix (`bg-`, `text-`, `border-`, etc.) are forbidden. Tailwind v4's JIT compiler only emits CSS for literal class names — a dynamic `` `bg-${prefix}-${step}` `` produces no styles and renders unstyled (Golden Rule #23o).

When adding a new check, update both the `CodingStandardsConfig` interface and the config object in `coding-standards.config.ts`.

---

---

## 15. GitHub Branch Protection Setup (One-Time, Per Repository)

The CI workflows enforce coverage thresholds and E2E requirements automatically, but the **merge button** is only blocked by GitHub branch protection rules. A team lead must configure these once when creating a new project from this template.

### Required Status Checks (must pass before merging)

Configure these checks as **required** on `main` and `develop`:

| Workflow file          | Job name                             | What it enforces                                                |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `ci-test-affected.yml` | `Test Affected (Unit + Integration)` | Unit tests + coverage thresholds pass for all affected projects |
| `ci-e2e.yml`           | `API E2E Tests`                      | Backend API E2E pass (or skipped for frontend-only PRs)         |
| `ci-e2e.yml`           | `Webapp E2E Tests (Playwright)`      | Webapp Playwright E2E pass (or skipped for backend-only PRs)    |
| `ci-fast-check.yml`    | `Quick Validation (Affected Only)`   | Lint + build pass                                               |

> **Note on skipped jobs:** When a PR only touches backend files, the `Webapp E2E Tests` job is automatically _skipped_ (not failed). GitHub treats a skipped required check as passing — this is correct behaviour. The same applies to `API E2E Tests` on frontend-only PRs.

### Step-by-Step: GitHub Repository Settings

1. Go to **Settings → Branches → Add rule** (or edit existing rule for `main`/`develop`).
2. Branch name pattern: `main` (repeat for `develop`).
3. Enable:
   - ✅ **Require a pull request before merging**
     - Required approvals: `1` (minimum)
     - ✅ Require review from Code Owners (uses `.github/CODEOWNERS`)
     - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Add each job name from the table above as a required status check
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings** (optional but recommended for main)
4. Click **Save changes**.

### Step-by-Step: Set Up CODEOWNERS

1. Open `.github/CODEOWNERS`.
2. Replace the team reference (`@xnnx-c-xrxnxs/senior-devs` by default) with your actual GitHub organization and team slug. All paths already use a single team — update the team slug only.
3. Commit directly to `main` (or via a setup PR).
4. Verify: open a draft PR touching any file — `@your-org/your-team` should be auto-requested as reviewer.

### Adding a New Domain (Branch Protection Checklist)

When a developer adds a new domain (e.g. `shipping`), no workflow changes are needed (Nx `affected` picks it up automatically), but the following must be true before the PR can merge:

- [ ] `packages/shipping-domain/jest.config.ts` has `coverageThreshold: { global: { branches: 80, ... } }`
- [ ] `apps/shipping/shipping-api-service/jest.config.cts` has `coverageThreshold: { global: { branches: 70, ... } }`
- [ ] `apps/shipping/shipping-api-service-e2e/project.json` has `"passWithNoTests": false` (prevents silent CI pass with zero E2E specs)
- [ ] At least one E2E spec file exists in `apps/shipping/shipping-api-service-e2e/src/`
- [ ] New service registered in `.github/service-registry.json` and `.github/service-registry.env`

### Coverage Threshold Reference

| Project type                            | Threshold       | Jest config location                      |
| --------------------------------------- | --------------- | ----------------------------------------- |
| Domain packages (`packages/*-domain`)   | 80% all metrics | `packages/{domain}-domain/jest.config.ts` |
| Service apps (`apps/*/`)                | 70% all metrics | `apps/{domain}/{service}/jest.config.cts` |
| Shared packages (`client-common`, etc.) | 70% all metrics | `packages/{name}/jest.config.ts`          |
| Frontend apps (`webapp`, `mobile`)      | 70% all metrics | `apps/{name}/jest.config.cts`             |
| E2E projects                            | No threshold    | N/A                                       |

---

**The ADR policy, agent operating rules, and Nx guidelines live in the root
[CLAUDE.md](../CLAUDE.md).**
**Questions or Issues?** Open an issue in the repository or contact the team.
