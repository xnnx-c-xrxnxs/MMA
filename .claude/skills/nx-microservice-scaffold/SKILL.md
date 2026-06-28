---
name: nx-microservice-scaffold
description: Register a new NestJS microservice as a valid Nx workspace project. Use this when creating a brand new service under apps/{domain}/{service}/. Covers project.json, tsconfig files, webpack.config.js, jest.config.cts, and tsconfig.base.json path alias registration.
---

# Registering a New Microservice in the Nx Workspace

This skill covers **workspace-level registration only** — project config files, build targets, and path aliases. For the NestJS internal layer structure (controllers, modules, filters, etc.) use the `nestjs-service-layers` skill.

> **Event-Driven Services (SQS consumers):** Apply this skill for Nx project files only, then follow the `sqs-event-driven-service` skill for all internal layers. Apply these rule differences:
> - **Skip** the port registration step — event-driven services have no HTTP server.
> - **Do not install** `@nestjs/swagger`.
> - **Install** `@aws-sdk/client-sqs` (runtime) and `@types/aws-lambda` (dev) instead.
> - The `Service: Serve {service-name}` VS Code task is still required.

> **Node.js version:** The workspace targets Node.js 24 (Active LTS). A `.nvmrc` at the workspace root pins this — run `nvm use` before starting. All `tsconfig.app.json` files must use `"target": "es2022"`. Do **not** add a local `@types/node` — the workspace root provides `^24.0.0`.

---

## Required Information — Ask Before Starting

1. **Domain name** (e.g. `orders`, `products`) — determines the `apps/{domain}/` folder
2. **Service name** (e.g. `order-api-service`) — the Nx project name and folder
3. **Which domain package does this service use?** (e.g. `@mma/{domain}-domain`)
4. **Output dist path** — follows convention `dist/apps/{domain}/{service}`
5. **Service port** — check the port registry in `CLAUDE.md §7.1` and claim the next available port. Add `{DOMAIN}_SERVICE_PORT={PORT}` and `API_{DOMAIN}_URL=http://localhost:{PORT}/api` to `.env.local` at the workspace root. Register both in the registry table in §7.1.

---

## Required Dependencies

Before scaffolding files, install the service-level packages. These are **not** at the workspace root and must be added per-service.

### DynamoDB-based service (default)

```bash
# Runtime dependencies
pnpm add @nestjs/swagger --filter {service-name}
```

Verify the service `package.json` shows:
- `@nestjs/swagger` in `dependencies`

### Prisma-based service

```bash
# Runtime dependencies
pnpm add @nestjs/swagger --filter {service-name}
```

Verify the service `package.json` shows the same as DynamoDB-based. The key difference is in the **domain package** — Prisma-based domains use `@prisma/client` (in the domain `package.json`, not the service `package.json`). They do **not** need `@mma/dynamodb-onetable`.

> For Prisma-based services, also add `{DOMAIN}_DATABASE_URL` to `.env.local` instead of `{DOMAIN}_DYNAMODB_TABLE_NAME`. See the `prisma-service-wiring` skill for wiring details.

> `@nestjs/platform-express` and `express` are already in the root `dependencies` — no extra install needed for those.
> API services no longer need `@codegenie/serverless-express` or `@types/aws-lambda` — Lambda Web Adapter handles Lambda↔HTTP translation via a public Lambda layer.

---

## Directory Structure to Create

```
apps/{domain}/{service}/
  project.json
  webpack.config.js
  tsconfig.json
  tsconfig.app.json
  tsconfig.spec.json
  jest.config.cts
  src/
    main.ts
    app/
    application/
      services/
    infrastructure/
      config/
    modules/
    presentation/
      controllers/
      filters/
      pipes/
```

---

## `project.json`

```json
{
  "name": "{service-name}",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/{domain}/{service}/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "webpack-cli build",
        "args": ["--node-env=production"],
        "cwd": "apps/{domain}/{service}"
      },
      "configurations": {
        "development": {
          "args": ["--node-env=development"]
        }
      }
    },
    "serve": {
      "continuous": true,
      "executor": "@nx/js:node",
      "defaultConfiguration": "development",
      "dependsOn": ["build"],
      "options": {
        "buildTarget": "{service-name}:build",
        "runBuildTargetDependencies": false
      },
      "configurations": {
        "development": {
          "buildTarget": "{service-name}:build:development"
        }
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/{domain}/{service}"],
      "options": {
        "jestConfig": "apps/{domain}/{service}/jest.config.cts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "prune-lockfile": {
      "dependsOn": ["build"],
      "cache": true,
      "executor": "@nx/js:prune-lockfile",
      "outputs": [
        "{workspaceRoot}/dist/apps/{domain}/{service}/package.json",
        "{workspaceRoot}/dist/apps/{domain}/{service}/pnpm-lock.yaml"
      ],
      "options": { "buildTarget": "build" }
    },
    "copy-workspace-modules": {
      "dependsOn": ["build"],
      "cache": true,
      "outputs": ["{workspaceRoot}/dist/apps/{domain}/{service}/workspace_modules"],
      "executor": "@nx/js:copy-workspace-modules",
      "options": { "buildTarget": "build" }
    },
    "prune": {
      "dependsOn": ["prune-lockfile", "copy-workspace-modules"],
      "executor": "nx:noop"
    }
  }
}
```

**Important:** The `prune-lockfile`, `copy-workspace-modules`, and `prune` targets are **required for Lambda ZIP packaging**. Use the `@nx/js:*` executors above — do **not** use `nx:run-commands` with bespoke `node tools/scripts/*.js` shims (those scripts do not exist in the workspace and their failure was historically masked by `|| true` in CD, producing `EUNSUPPORTEDPROTOCOL workspace:*` failures at deploy time — see ADR-005). The official executors:
1. `@nx/js:prune-lockfile` — Generates a pruned `dist/package.json` with `workspace:*` resolved to real versions, plus a pruned `pnpm-lock.yaml`.
2. `@nx/js:copy-workspace-modules` — Copies workspace package source into `dist/workspace_modules/` for hoisted resolution at runtime.
3. `prune` (`nx:noop`) — Aggregator target so a single `nx run {service}:prune` triggers the two above via `dependsOn`.

**Never ship a per-app `package.json` for a Lambda service.** `@nx/js:prune-lockfile` derives one from the workspace lockfile. A hand-rolled `apps/{domain}/{service}/package.json` with `workspace:*` deps gets copied through to `dist/` untouched and crashes `npm install --omit=dev` at deploy time. Enforced by the `no-workspace-protocol-in-lambda-package-json` structural lint check.

---

## `webpack.config.js`

```javascript
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../../dist/apps/{domain}/{service}'),
    libraryTarget: 'commonjs2',
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
```

**Prisma services only — additional webpack requirements:**

If the service uses Prisma + PostgreSQL, add the following to suppress source map warnings from the generated client and to copy the engine binary + schema:

```javascript
module.exports = {
  // ... output block unchanged
  ignoreWarnings: [
    { module: /@mma\/{domain}-domain\/src\/infrastructure\/generated\/client/ },
  ],
  plugins: [
    new NxAppWebpackPlugin({
      // ... all existing options unchanged
      assets: [
        './src/assets',
        {
          input: 'packages/{domain}-domain/src/infrastructure/prisma',
          glob: 'schema.prisma',
          output: '.',
        },
        {
          input: 'node_modules/.prisma/client',
          glob: 'libquery_engine-rhel-openssl-3.0.x.so.node',
          output: '.',
        },
      ],
    }),
  ],
};
```

Without these entries, the Lambda will fail at runtime with "unable to locate libquery_engine" — the Prisma engine binary must be copied into the `dist/` output alongside `schema.prisma`.

---

## `tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ],
  "compilerOptions": {
    "esModuleInterop": true
  }
}
```

---

## `tsconfig.app.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "module": "commonjs",
    "types": ["node"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "es2022",
    "moduleResolution": "node"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "jest.config.ts",
    "jest.config.cts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts"
  ]
}
```

---

## `tsconfig.spec.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": [
    "jest.config.ts",
    "jest.config.cts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts"
  ]
}
```

---

## `jest.config.cts`

```typescript
export default {
  displayName: '{service-name}',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/apps/{domain}/{service}',
};
```

---

## `tsconfig.base.json` — Path Alias Registration (Required)

After creating the domain package, add its path aliases to `tsconfig.base.json` at the workspace root. This is the most frequently forgotten step.

```json
// In tsconfig.base.json compilerOptions.paths, add:
"@mma/{domain}-domain": ["packages/{domain}-domain/src/index.ts"],
"@mma/{domain}-domain/infrastructure": ["packages/{domain}-domain/src/infrastructure/index.ts"]
```

Without this step, the service will fail to build with "Cannot find module '@mma/{domain}-domain'" errors.

---

## VS Code Task Registration (Required)

After creating the service files, register two VS Code task entries so every developer can start the service from **Terminal → Run Task** without memorising commands.

### 1. Add a `Service: Serve` task

Open `.vscode/tasks.json` and add the following entry inside the `tasks` array, in the *Microservices* block (after the last existing service task):

```json
{
  "label": "Service: Serve {service-name}",
  "type": "shell",
  "command": "npx nx serve {service-name}",
  "isBackground": true,
  "options": {
    "env": {
      "NX_TUI": "false"
    }
  },
  "presentation": {
    "reveal": "always",
    "focus": true,
    "panel": "new"
  },
  "problemMatcher": [
    {
      "pattern": [
        {
          "regexp": ".",
          "file": 1,
          "location": 2,
          "message": 3
        }
      ],
      "background": {
        "activeOnStart": true,
        "beginsPattern": ".",
        "endsPattern": "is running on"
      }
    }
  ]
}
```

Replace `{service-name}` with the Nx project name (e.g. `order-api-service`).

> **Why `NX_TUI=false` is required:** Nx 17+ runs tasks inside a full-screen TUI (Terminal User Interface) that takes over the terminal in raw/PTY mode. While the TUI is active, `Ctrl+K` clear is captured by Nx and does not work, and `console.warn`/`console.error` output from the running service may be buffered or reformatted by the TUI renderer rather than written directly to the terminal. Setting `NX_TUI=false` disables the TUI and gives a plain scrolling log where all output is visible immediately and the terminal behaves normally.
>
> **Why `focus: true` matters:** `"focus": true` forces VS Code to bring the terminal to the foreground when it produces output, ensuring log lines are always visible.
>
> **Why `"group"` must NOT be set:** Adding `"group": "services"` (or any group name) causes VS Code to split all tasks with the same group into a single shared panel. Each service should run in its own dedicated terminal panel (`"panel": "new"` without `"group"`) so logs are not interleaved and each terminal can be resized independently.
>
> **Why the `background` matcher matters:** `isBackground: true` with `"problemMatcher": []` causes VS Code to mark the task as finished immediately after launch, which can hide/close the output panel. The `background` pattern keeps VS Code tracking the process as alive, so the terminal panel stays open and all log output remains visible.

### 2. Add the label to `Services: Start All`

In the same file, find the compound task labelled `Services: Start All` and append the new service label to the `dependsOn` array:

```json
{
  "label": "Services: Start All",
  "dependsOn": [
    "Service: Serve user-api-service",
    "Service: Serve product-api-service",
    "Service: Serve {service-name}"   // ← add this line
  ],
  "dependsOrder": "parallel",
  ...
}
```

> **Why this matters:** `Dev: Start All` boots infrastructure first (`Infra: Start + Setup` — Docker, LocalStack tables, Prisma migrations), then starts all services in parallel via `Services: Start All`. If your service is not listed in `Services: Start All`, it is invisible to the compound launcher and other developers will miss it.

### 3. (Prisma domains only) Register in the migration script

If the new service uses Prisma + PostgreSQL, add the domain to `scripts/prisma-migrate-all.ts` → `PRISMA_DOMAINS` array. This ensures `DB: Migrate All` (run by `Infra: Start + Setup`) applies pending migrations for the new domain before any service starts.

See the `prisma-service-wiring` skill, Step 5 for details.

---

## Verification

Before building, confirm the required dependencies are installed (see **Required Dependencies** section above). Then run:

```bash
npx nx build {service-name} --skip-nx-cache
```

If the build passes, the project is correctly registered. If it fails with:
- **Path resolution errors** → check `tsconfig.base.json` first.
- **`Cannot find module '@nestjs/swagger'`** → run the `pnpm add` commands in Required Dependencies.
- **`Cannot find module '@nestjs/swagger'`** → same as above.

Also verify `.env.local` at the workspace root contains both `{DOMAIN}_SERVICE_PORT={PORT}` and `API_{DOMAIN}_URL=http://localhost:{PORT}/api` for the new service.

---

## CI Registration (Required for Every New HTTP API Service)

The CI pipelines read from two files that act as a service inventory. Both must be updated when adding a new HTTP API service.

### 1. `.github/service-registry.json`

Add a new entry to the `apiServices` array. This tells CI which Nx project to build and where the compiled `main.js` lives:

```json
{
  "name": "{service-name}",
  "distPath": "dist/apps/{domain}/{service-name}/main.js"
}
```

### 2. `.github/service-registry.env`

Add a domain section with all per-service E2E env vars. These are loaded dynamically by `ci-e2e.yml` — no workflow YAML edits are needed for DynamoDB domains.

**DynamoDB domain:**
```bash
# --- {Domain} domain (DynamoDB) ---
{DOMAIN}_SERVICE_PORT={PORT}
API_{DOMAIN}_URL=http://localhost:{PORT}/api
NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{PORT}/api
{DOMAIN}S_DYNAMODB_TABLE_NAME={DOMAIN}S_E2E
{DOMAIN}_SQS_QUEUE_NAME={domain}-events-e2e
{DOMAIN}_SQS_QUEUE_URL=http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/{domain}-events-e2e
```

**Prisma domain:**
```bash
# --- {Domain} domain (Prisma) ---
{DOMAIN}_SERVICE_PORT={PORT}
API_{DOMAIN}_URL=http://localhost:{PORT}/api
NEXT_PUBLIC_API_{DOMAIN}_URL=http://localhost:{PORT}/api
{DOMAIN}S_DATABASE_URL=postgresql://dev:dev@localhost:5432/{domain}s_e2e_db
{DOMAIN}_SQS_QUEUE_NAME={domain}-events-e2e
{DOMAIN}_SQS_QUEUE_URL=http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/{domain}-events-e2e
```

> **Prisma only — additional manual step:** Add a `postgres` service container to the `services:` block in `ci-e2e.yml` (both `api-e2e-tests` and `webapp-e2e-tests` jobs) and in `ci-test-all.yml` (`integration-tests` job). Match the DB name used in `service-registry.env`. Also add `{DOMAIN}_DATABASE_URL` to the `env:` block of the `test-affected` job in `ci-test-affected.yml`.
>
> This is the **only** workflow YAML change needed when adding a new domain. Everything else is handled via the two registry files.

> **Event-driven services** do not register in `service-registry.json` or `service-registry.env` — they have no HTTP server and are not started by CI's `start-api-services.sh` script.

---

## Next Step

Once the Nx project is registered, use the `nestjs-service-layers` skill to scaffold the full internal NestJS layer structure.
