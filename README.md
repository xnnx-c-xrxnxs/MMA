# mma

> A production-grade, AI-first full-stack TypeScript template — Nx monorepo, NestJS microservices, Next.js webapp, Expo mobile app, Terraform-driven AWS deployment.

## What's in the box

**Template core (always ships):**

- **Auth API service** — sign-in, refresh, password flows; pluggable provider (Cognito or local). [apps/auth/](apps/auth/)
- **File API service** — S3 presigned upload/download URLs, no bytes through backend. [apps/files/](apps/files/)
- **Internal monitoring tool** — in-house dashboard for traces, alarms, metrics. [apps/monitoring/](apps/monitoring/)
- **Webapp shell** — Next.js App Router + auth middleware + design tokens + dark mode. [apps/webapp/](apps/webapp/)
- **Mobile shell** — Expo Router + secure-storage auth + Sentry + EAS pipeline. [apps/mobile/](apps/mobile/)
- **Shared packages** — `@mma/ui`, `@mma/mobile-ui`, `@mma/client-common`, `@mma/contracts`, `@mma/telemetry`, `@mma/aws-*`. [packages/](packages/)
- **Infrastructure** — Terraform modules + bootstrap + preview environments + init-runner. [infra/](infra/)
- **CI/CD** — 11 GitHub Actions workflows (CI, CD, security, hygiene). [.github/workflows/](.github/workflows/)
- **AI-native scaffolding** — 50+ task-scoped Claude Code skills + workflow orchestrators. [.claude/skills/](.claude/skills/) + [.claude/commands/](.claude/commands/)

**Reference implementation (in `examples/`, removed by `init-project.mjs` unless `--keep-examples`, or independently via `scripts/remove-examples.mjs`):**

- **3 worked-example bounded contexts** — User (DynamoDB), Product (DynamoDB), Order (Prisma)
- **Cross-context patterns** — sync ACL, async events, choreography sagas
- **End-to-end webapp + mobile** wired to all three domains
- **API E2E + Playwright E2E** test suites

Keep `examples/` until your team has scaffolded its own first domain via `/new-domain`, then drop it.

**Cross-cutting capabilities** (work in both core and examples):

- Dual persistence: DynamoDB OneTable + Prisma/PostgreSQL
- Observability: structured logging + OpenTelemetry + X-Ray + correlationId end-to-end
- Deployment: Lambda + shared API Gateway + ECS/Lambda webapp, all driven by `.github/service-registry.json`
- Security: GitHub OIDC for AWS, JWT two-tier auth, httpOnly refresh cookies, Dependabot + template-hygiene gate (CodeQL via GitHub-native default setup)

## 🚀 Just created a new project from this template?

**→ Follow [`docs/PROJECT_BOOTSTRAP.md`](docs/PROJECT_BOOTSTRAP.md)** for the full, detailed, step-by-step guide.

The short version: after `gh repo create --template`, open VS Code in the new repo, run the **`Project: Bootstrap (One-Step)`** task, and answer the prompts. That single task renames the scope/project/org/CODEOWNERS, deletes `examples/`, commits + pushes `main`, creates + pushes `develop`, and applies branch rulesets + `dev`/`staging`/`prod` environments. Then continue with NotebookLM context extraction, label seeding, and sprint planning — all covered in the bootstrap guide.

## Quick Start (running locally)

```sh
# Prereqs: Node 24, pnpm, Docker Desktop
nvm use && pnpm install
cp .env.local.example .env.local
docker compose up -d
pnpm run localstack:setup
pnpm run prisma:migrate:all

# In VS Code: Tasks: Run Task -> "Dev: Start All"
```

Then open:
- `http://localhost:4200` — webapp
- `http://localhost:3000/api/docs` — User API Swagger
- Sign in with `admin@test.com` / `Password123!`

Full instructions in **[docs/getting-started.md](docs/getting-started.md)**.

## Documentation

| Topic | Link |
|---|---|
| **Get the template running locally** | [docs/getting-started.md](docs/getting-started.md) |
| **Architecture & golden rules** | [docs/architecture.md](docs/architecture.md) |
| **Coding standards (enforcement reference)** | [docs/coding-standards.md](docs/coding-standards.md) |
| **Testing strategy** | [docs/testing.md](docs/testing.md) |
| **CI/CD pipeline** | [docs/ci-cd.md](docs/ci-cd.md) |
| **Deploy to AWS** | [docs/deployment.md](docs/deployment.md) |
| **Infrastructure (Terraform)** | [docs/infrastructure.md](docs/infrastructure.md) |
| **Bootstrap (one-time AWS setup)** | [docs/bootstrap.md](docs/bootstrap.md) |
| **Cost transparency (AWS spend per env)** | [docs/cost-transparency.md](docs/cost-transparency.md) |
| **Template updates (downstream sync)** | [docs/template-updates.md](docs/template-updates.md) |
| **Monitoring & observability** | [docs/monitoring.md](docs/monitoring.md) |
| **Notifications & alerting** | [docs/notifications.md](docs/notifications.md) |
| **Troubleshooting** | [docs/troubleshooting.md](docs/troubleshooting.md) |
| **Interactive HTML docs** | [docs/html/index.html](docs/html/index.html) |
| **Tutorials** | [docs/tutorial/](docs/tutorial/) |

The full **documentation index** is at [docs/README.md](docs/README.md).

## For AI Agents

This repo is configured for Claude Code (and compatible agents):

| File | Purpose |
|---|---|
| `CLAUDE.md` | Always-loaded primary instructions (37 golden rules + skill mapping) |
| `docs/code-review-guidelines.md` | PR review standards |
| `.claude/skills/` | 50+ task-scoped skills (loaded on-demand) |
| `.claude/commands/` | Workflow orchestrators (`/new-domain`, `/full-stack-feature`, etc.) |
| `nested CLAUDE.md files (per-folder, was ` | Per-folder rules (auto-attach by glob) |
| `AGENTS.md` | Nx MCP server conventions |

When asking the agent for help:

> *"Add a `payment-domain` with DynamoDB persistence and an HTTP API service"*

...the agent will load the `new-domain` orchestrator, interview you for missing details, then execute through `new-domain-package`, `new-dynamo-schema`, `nestjs-service-layers`, `nx-microservice-scaffold`, `cd-register-service`, and other skills in sequence — producing working, lint-passing, tested code.

## License

MIT — see [LICENSE](LICENSE).

## Security

Report vulnerabilities privately per [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Keeping a downstream project in sync with the template

See [docs/template-updates.md](docs/template-updates.md) for the recommended workflow (cherry-picking template improvements into a project that was bootstrapped from a previous version).
