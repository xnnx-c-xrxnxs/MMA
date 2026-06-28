# Contributing

Thanks for contributing. This document covers contributions to **the template itself**. If you are working on a downstream project that was bootstrapped from this template, follow your project's own conventions — but the architecture rules in [CLAUDE.md](CLAUDE.md) still apply.

## Quick Start

1. Read the [README](README.md) and [docs/getting-started.md](docs/getting-started.md).
2. Install Node.js 24 (run `nvm use` after cloning) and pnpm 9+.
3. Install dependencies: `pnpm install`.
4. Start local infra: run the `Infra: Start All` VS Code task (or `docker compose up -d` + `pnpm run localstack:setup`).
5. Run tests: `pnpm nx run-many -t test --skip-nx-cache`.

## Workflow

- **Branch from `develop`**; PRs target `develop`. Releases promote `develop` → `main`.
- **One concern per PR.** Keep diffs reviewable.
- **All new code must include tests.** Coverage thresholds are enforced in CI (see [CLAUDE.md §12](CLAUDE.md)).
- **Run the full check before pushing**: `pnpm nx affected -t lint,test,build`.
- **Conventional commits encouraged** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

## Architecture Rules (Non-Negotiable)

This is a Clean Architecture template. Before adding code, read:

- **Golden Rules**: [CLAUDE.md §2](CLAUDE.md)
- **Skills catalogue**: `.claude/skills/` — load the relevant `SKILL.md` before scaffolding any new domain, service, page, or contract.
- **Workflow orchestrators**: `.claude/commands/` — guided multi-phase scaffolds (`/new-domain`, `/new-feature`, `/full-stack-feature`, etc.).

Highlights:
- Use cases never live in controllers — Application Services orchestrate.
- Domain layer has zero NestJS / framework imports.
- Contracts use **subpath imports only** (`@old-st/contracts/{domain}` — never the bare root).
- Cross-service calls use the ACL pattern (see `sync-cross-service-call` skill).
- All HTTP API services expose `GET /api/health` returning `{ status: 'ok', service }` with `@Public()`.
- Read the actor identity from `@CurrentUser()` — never from request body/query/path.

## Pull Request Checklist

- [ ] Tests added/updated and passing locally
- [ ] `pnpm nx affected -t lint` passes
- [ ] `pnpm nx affected -t build` passes
- [ ] Structural lint passes: `pnpm tsx scripts/lint-standards.ts`
- [ ] If touching contracts: ran `contract-diff-analyzer` agent or manually verified consumers
- [ ] If adding a domain/service: added entry to `.github/service-registry.json` and `.github/service-registry.env`
- [ ] Documentation updated (README, docs/, or skill files) if behaviour changed
- [ ] No secrets, real account IDs, or client-specific identifiers in the diff

## Adding a Skill or Orchestrator Prompt

The skills system is the template's main competitive surface. When adding one:

1. Create `.claude/skills/{skill-name}/SKILL.md` with a clear description, "When to use", file paths it touches, and a worked example.
2. Add a row to the **Skill → Task mapping** table in `CLAUDE.md`.
3. If the skill is part of a multi-phase workflow, add or update a `.claude/commands/{name}.md` orchestrator.
4. Update the **Workflow Orchestrators** table in `CLAUDE.md`.

## Reporting Bugs / Requesting Features

Use the issue templates in `.github/ISSUE_TEMPLATE/`. Security issues — see [SECURITY.md](SECURITY.md).

## Code of Conduct

By contributing you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
