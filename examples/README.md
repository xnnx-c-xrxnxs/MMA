# Examples — Reference Implementation

> **Status:** Frozen reference implementation. Excluded from the main workspace's CI/CD.
> **Mental model:** The repo root is a clean base template (auth, files, monitoring, UI primitives, mobile UI primitives, narrowed `client-common`). This `examples/` directory contains the **complete previous implementation** (users + products + orders + categories + payment contracts, full webapp, full mobile, full e2e) preserved as an authoritative reference for every workflow skill.

## Why this exists

Skills, instruction files, workflow prompts, and sub-agents in `.github/` describe **how** to add a domain, build a webapp page, wire a saga, etc. — but a sentence is not as good as a working file. When a skill says _"the application service transforms entities to DTOs via Zod schemas (see footer)"_ the footer points here:

> **Reference implementation:** [examples/packages/user-domain/.../user-application.service.ts](packages/user-domain/src/application/services/user-application.service.ts)

Every skill that references `examples/` does so via that exact footer pattern — enforced by the `skills-no-example-imports` lint check.

## Two-workspace mental model

| | Main workspace (root) | Examples workspace (this dir) |
|---|---|---|
| `pnpm-workspace.yaml` | `apps/*`, `packages/**` | `apps/**`, `packages/**` (own scope) |
| `nx.json` | Builds, tests, deploys | Builds + tests in isolation; **never deploys** |
| `node_modules` | Root-level | Own copy (gitignored) |
| Shared deps (UI, telemetry, AWS adapters) | Source of truth | Consumed via `link:../packages/*` |
| CI / CD | Runs on every PR | **Skipped** (`paths-ignore: examples/**`) |
| Visible in `nx graph` | Yes | No |

This isolation means:

- A green `pnpm nx run-many -t build,test` at the root never depends on examples being correct.
- A breaking change to a `packages/ui/` primitive surfaces the same break in `examples/` (because `link:`), so examples are a **drift detector** for the design system.
- A new project bootstrapped via `scripts/init-project.mjs` can opt-out of examples entirely (`--keep-examples=false` is the default).
- If you only want to drop `examples/` without running the full bootstrap (no scope rename, no git re-init), run `scripts/remove-examples.mjs` — or use the `Template: Remove examples/` VS Code task. It deletes this directory and strips `paths-ignore: examples/**` from `.github/workflows/*.yml`; nothing else.

## Quickstart (run an example service in isolation)

```powershell
# 1. From the REPO ROOT — start shared infrastructure (LocalStack + Postgres) and create example tables/queues:
docker compose up -d
pnpm run localstack:setup       # creates USERS, PRODUCTS DynamoDB tables + SQS queues
pnpm run db:migrate             # applies Prisma migrations for the orders Postgres database

# 2. Then from inside examples/:
cd examples
pnpm install                    # resolves link: deps to ../packages/*
pnpm nx serve user-api-service
# In another terminal:
pnpm nx serve webapp            # full reference webapp with all 3 example domains wired
```

> **Why setup-localstack and db:migrate live at the root, not here:** they target a single shared LocalStack instance (port 4566) and a single shared Postgres instance (port 5432). The tables they create (`USERS`, `PRODUCTS`) and the database they migrate (`orders_db`) are example-domain resources used only by services in this directory — but the scripts themselves stay at the root so any dev can boot the example stack with one command.

## Skill → reference mapping

See [INDEX.md](INDEX.md) for the full table mapping every skill to its canonical reference file in this directory.

## Maintenance

- **Refresh cadence:** every 6 months, run the example workspace's full test suite to catch drift from the main packages it `link:`s to.
- **When to update:** after any architectural change that affects 3+ skills (e.g. changing the structured-logging contract, the `@CurrentUser()` decorator shape, the JWT guard wiring).
- **Never deploy:** examples are never built into Lambda zips, never pushed to ECR, never registered in `service-registry.json`. The main workspace's CD ignores them.

## Limitations

- Examples do not deploy to AWS — `service-registry.json` lives in the root and only lists main-workspace services.
- Local infrastructure (LocalStack, Docker Postgres) is shared with the root via `docker-compose.yml`. Examples reuse the same containers; their setup script creates additional tables/queues.
- Examples have their own `.env.local` (see `.env.local.example` here) — not the root one.
