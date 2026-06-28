# Subagent Catalog

The `.claude/agents/` folder contains every **subagent** definition the workspace ships. Subagents are spawned by orchestrator prompts (`.claude/commands/*.md`) via the `Agent` tool. The developer never picks them directly — they are invisible plumbing that runs inside a workflow.

For the broader architecture (Router → Orchestrator → Subagents), see [docs/AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md).

---

## What a Subagent Is

| Property        | Definition                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **File**        | `{name}.md` with YAML frontmatter (`description`) + Markdown body                                        |
| **Spawned by**  | Orchestrator prompts via `Agent(subagent_type="{name}", prompt="...")`                                            |
| **Scope**       | Either fully **read-only** (audit / analysis) or **scoped-write** (build agent restricted to specific folders) |
| **Output**      | Always a single Markdown report — never raw tool dumps                                                         |
| **Lifetime**    | One invocation = one report; no persistent state between runs                                                  |
| **Parallelism** | Read-only agents are safe to run in parallel; write agents serialize within their scope                        |

---

## Catalog

### Top-Level Orchestration (3)

| Name                                                  | Type      | Description                                                                                       |
| ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| [orchestrator-router](./orchestrator-router.md) | read-only | Classifies free-text user intent → recommends the right slash command. Never auto-dispatches.     |
| [result-aggregator](./result-aggregator.md)     | read-only | Composes one unified Markdown report from N parallel subagent outputs at the end of a workflow.   |
| [pr-summary-writer](./pr-summary-writer.md)     | read-only | Reads the diff + aggregator report → drafts the PR description that replaces the WIP placeholder. |

### Discovery (read-only, used during orchestrator Phase 0 / 0.5)

| Name                                                        | Description                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [prompt-skill-loader](./prompt-skill-loader.md)       | Pre-loads N skill files in parallel and returns one compact digest. Saves context budget.     |
| [domain-explorer](./domain-explorer.md)               | Maps a single bounded context end-to-end (entity, use cases, repo, schema, controller).       |
| [contract-diff-analyzer](./contract-diff-analyzer.md) | Diffs a contracts change against ALL consumers → classifies additive / tightening / breaking. |
| [event-flow-tracer](./event-flow-tracer.md)           | Maps a domain event publisher → queues → handlers → use cases → mutations.                    |
| [monitoring-tracer](./monitoring-tracer.md)           | Maps which services have CloudWatch alarms + `createLogger()` wired; surfaces gaps.           |
| [port-claim-checker](./port-claim-checker.md)         | Validates the §7.1 port + API URL registry; reports the next available port.                  |

### Validation (read-only, used at end of orchestrator)

| Name                                                        | Description                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [golden-rule-validator](./golden-rule-validator.md)   | Audits a change against behavioural Golden Rules (#28, #35, #36, #45, #46).                      |
| [dependency-auditor](./dependency-auditor.md)         | Grep-based Clean Architecture violation scan (bare contracts import, cross-domain, Prisma leak). |
| [security-reviewer](./security-reviewer.md)           | OWASP Top-10 review focused on auth / JWT / header propagation / rate-limit / enumeration leaks. |
| [test-coverage-analyzer](./test-coverage-analyzer.md) | Reads Jest coverage + spec files → highlights uncovered branches per entity / use case / hook.   |
| [e2e-impact-predictor](./e2e-impact-predictor.md)     | Maps changed files → the API + Playwright specs likely to be affected, with confidence score.    |
| [migration-planner](./migration-planner.md)           | Predicts what breaks BEFORE `prisma migrate dev` runs.                                           |

### Build Agents (scoped-write)

| Name                                        | Write scope                                                                       | Description                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [webapp-builder](./webapp-builder.md) | `apps/webapp/`, `packages/client-common/`, `packages/ui/` (only if new primitive) | Builds the webapp slice of a feature after the backend is frozen. |
| [mobile-builder](./mobile-builder.md) | `apps/mobile/`, `packages/mobile-ui/`                                             | Builds the mobile slice in parallel with `webapp-builder`.        |

### Migration (used by `/migrate-*` orchestrators)

| Name                                                        | Type                                                                          | Description                                                                                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [domain-spec-writer](./domain-spec-writer.md)         | scoped-write (`.specs/`)                                              | Translates ONE domain card → ONE `domain-{name}.yaml` (single entity per file). Spawned by `/migrate-to-specs`.                                                                                    |
| [page-spec-writer](./page-spec-writer.md)             | scoped-write (`.specs/`)                                              | Translates ONE route card + classification → ONE `page-{slug}.yaml`, cross-checking every field against the domain spec. Spawned by `/migrate-to-specs`.                                           |
| [migration-page-builder](./migration-page-builder.md) | scoped-write (`(protected)/{route}/`, `components/{domain}/`, `packages/ui/`) | Builds a page once in its real route with a swappable `_data/{domain}.adapter.ts` (`--mock` interactive fixture → `--wire` real hooks). Spawned by `/migrate-page`.                                |
| [ui-primitive-builder](./ui-primitive-builder.md)     | scoped-write (`packages/ui/`)                                                 | Builds NEW `@mma/ui` primitives from a classification spec. Spawned by `/migrate-build-ui`.                                                                                                     |
| [composite-builder](./composite-builder.md)           | scoped-write (`apps/webapp/src/components/{domain}/`)                         | Builds prop-driven, presentational domain composites (no data fetching). Spawned by `/migrate-build-ui`.                                                                                           |
| [coverage-auditor](./coverage-auditor.md)             | read-only                                                                     | Reconciles the LEDGER against produced artifacts; FAILs on any non-terminal item. Spawned at reconciliation gates.                                                                                 |
| [preview-page-builder](./preview-page-builder.md)     | scoped-write                                                                  | **SUPERSEDED by `migration-page-builder`** — pages are now built once in `(protected)/{route}/`, not in a separate preview surface. Retained for reference only; not invoked by any active prompt. |

### Operations (read-only, on-demand)

| Name                                                          | Description                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| [ci-monitor-subagent](./ci-monitor-subagent.md)         | Polls Nx Cloud CI Attempt status with exponential backoff.           |
| [cloudwatch-investigator](./cloudwatch-investigator.md) | Queries CloudWatch logs/metrics for incident triage in prod/staging. |

---

## Tool Restrictions (Required Frontmatter)

Every agent file MUST declare:

1. **`description:`** in the YAML frontmatter — the discovery surface. Must include the trigger ("Use this when...") and scope (read-only vs scoped-write).
2. **`## Allowed Tools`** section listing exactly which tools the agent may invoke. Read-only agents must explicitly say **"NOT allowed: any write or terminal tools"**.

These are enforced at CI time by the `agent-frontmatter-required` check in [scripts/lint-standards.ts](../../scripts/lint-standards.ts).

## Reference Integrity

Every `Agent(subagent_type="X")` reference in `.claude/commands/**` must resolve to an existing `.claude/agents/X.md` file. Enforced by the `Agent-reference-resolves` check.

## When to Add a New Agent

Add a new agent when:

- The task is **read-only audit / analysis** and would otherwise burn 5+ files of context in the main agent.
- The task is a **scoped-write builder** that can run in parallel with other builders (e.g. webapp + mobile).
- Multiple existing orchestrators would benefit from the same logic.

Do NOT add a new agent for:

- A single-step task — use a skill instead.
- A linear sequence of steps inside one workflow — keep it in the prompt body.
- Long-running daemons / servers — agents are one-shot.

## See Also

- [docs/AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) — three-tier model and data-flow rules
- [docs/decisions/007-runsubagent-tool-mapping.md](./decisions/007-runsubagent-tool-mapping.md) — how `Agent` maps to a real tool
- [CLAUDE.md](../CLAUDE.md) §11 — workflow entry points table
- [.claude/commands/](../commands/) — orchestrator prompts that spawn these agents
