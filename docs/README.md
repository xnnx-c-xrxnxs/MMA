# Documentation

Welcome to the **mma** documentation.

This template is a full-stack Clean Architecture monorepo (Nx, NestJS, Next.js, Expo).

**Template core** ships an Auth API, File API, internal Monitoring tool, webapp shell, mobile shell, shared packages, Terraform modules, and CI/CD pipeline.

**Reference implementation** in `examples/` (removed by `init-project.mjs` unless `--keep-examples`, or independently via `scripts/remove-examples.mjs` / the `Template: Remove examples/` VS Code task) demonstrates three worked-example domains (User on DynamoDB, Product on DynamoDB, Order on Prisma) plus the cross-context patterns: synchronous ACL, async events, and choreography sagas.

## Reading Order

If you are new, read in this order:

1. **[Getting Started](getting-started.md)** — prerequisites, install, run services locally
2. **[Architecture](architecture.md)** — clean architecture layers, golden rules, coding standards
3. **[AI-Native Workflow Quickstart](ai-native-workflow-quickstart.md)** — daily flow, decision tree, example sessions (read this BEFORE writing your first feature)
4. **[Testing](testing.md)** — testing pyramid, coverage thresholds, E2E setup
5. **[CI/CD](ci-cd.md)** — GitHub Actions workflows, branch protection
6. **[Deployment](deployment.md)** — bootstrap, GitHub OIDC, first deploy, preview environments

## Topic Index

| Topic | Markdown | Interactive (HTML) |
|---|---|---|
| Getting started | [getting-started.md](getting-started.md) | — |
| **Daily AI-native workflow** | **[ai-native-workflow-quickstart.md](ai-native-workflow-quickstart.md)** | — |
| Clean Architecture | [architecture.md](architecture.md) | [html/architecture.html](html/architecture.html) |
| Bounded contexts | — | [html/domains.html](html/domains.html) |
| Domain interactions (sync ACL, events, sagas) | — | [html/domain-interactions.html](html/domain-interactions.html) |
| Persistence (DynamoDB + Prisma) | — | [html/persistence.html](html/persistence.html) |
| Contracts & Zod schemas | — | [html/contracts.html](html/contracts.html) |
| Event-driven (SQS) | — | [html/event-driven.html](html/event-driven.html) |
| Webapp (Next.js) | — | [html/webapp.html](html/webapp.html) |
| Mobile (Expo) | — | [html/mobile.html](html/mobile.html) |
| Authentication | — | [html/auth.html](html/auth.html) |
| Local infrastructure | — | [html/infrastructure.html](html/infrastructure.html) |
| Monitoring & observability | [monitoring.md](monitoring.md) | [html/monitoring.html](html/monitoring.html) |
| Notifications & alerting | [notifications.md](notifications.md) | [html/notifications.html](html/notifications.html) |
| Testing strategy | [testing.md](testing.md) | [html/testing.html](html/testing.html) |
| CI/CD pipeline | [ci-cd.md](ci-cd.md) | — |
| Deployment | [deployment.md](deployment.md) | [html/deployment.html](html/deployment.html) |
| Infrastructure (Terraform) | [infrastructure.md](infrastructure.md) | — |
| Bootstrap (one-time AWS setup) | [bootstrap.md](bootstrap.md) | — |
| Cost transparency (AWS spend per environment) | [cost-transparency.md](cost-transparency.md) | — |
| Template updates (downstream sync workflow) | [template-updates.md](template-updates.md) | — |
| AI workflow orchestrators | — | [html/ai-workflows.html](html/ai-workflows.html) |
| Troubleshooting | [troubleshooting.md](troubleshooting.md) | — |
| Project bootstrap (new repo from template) | [PROJECT_BOOTSTRAP.md](PROJECT_BOOTSTRAP.md) | — |
| Project context (AI-read snapshot) | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | — |
| Issue creation — BA quick start | [QUICK_START_BA.md](QUICK_START_BA.md) | — |
| Issue creation — full runbook | [ISSUE_CREATOR_RUNBOOK.md](ISSUE_CREATOR_RUNBOOK.md) | — |
| Issue creator prompt (AI instructions) | [AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md) | — |
| NotebookLM context extraction prompts | [NOTEBOOKLM_EXTRACTION_PROMPT.md](NOTEBOOKLM_EXTRACTION_PROMPT.md) | — |
| Migration workflow (import a source repo) | [MIGRATION_WORKFLOW_GUIDE.md](MIGRATION_WORKFLOW_GUIDE.md) | — |
| Architecture Decision Records (ADRs) | [decisions/](decisions/) | — |

## Tutorials

In-depth tutorials are in [tutorial/](tutorial/):

- [Clean Architecture deep dive](tutorial/clean-architecture.html)
- [Zod masterclass](tutorial/zod-masterclass.html)
- [AI Native Development masterclass](tutorial/masterclass.html)

## For AI Agents

The repository is configured for AI-first development with Claude Code:

- `CLAUDE.md` — primary instruction set (always loaded)
- `docs/code-review-guidelines.md` — code review standards
- `.claude/skills/` — 50+ task-scoped skills loaded on-demand
- `.claude/commands/` — workflow orchestrators for multi-step tasks
- nested `CLAUDE.md` files — per-folder instructions (auto-loaded inside that subtree)

See `AGENTS.md` at the repo root for Nx MCP server conventions.
