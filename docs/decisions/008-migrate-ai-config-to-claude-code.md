# ADR-008: Migrate AI configuration from GitHub Copilot to Claude Code

**Status:** ACCEPTED
**Date:** 2026-06

## Context

The repo's AI tooling layer (skills, prompts, subagents, path-scoped instructions, and the
global instruction file) was authored for **GitHub Copilot** under `.github/`. Claude Code
reads a different, non-overlapping set of locations, so none of that configuration was
visible to Claude Code:

| Purpose | Copilot (old) | Claude Code (new) |
| --- | --- | --- |
| Global instructions | `.github/copilot-instructions.md` | `CLAUDE.md` |
| Path-scoped rules | `.github/instructions/*.instructions.md` (`applyTo:` glob) | nested `CLAUDE.md` per folder |
| Slash commands / orchestrators | `.github/prompts/*.prompt.md` | `.claude/commands/*.md` |
| Subagents | `.github/agents/*.agent.md` | `.claude/agents/*.md` |
| Skills | `.github/skills/*/SKILL.md` | `.claude/skills/*/SKILL.md` |

We standardised on Claude Code as the team's coding agent and chose a **full, replacing**
migration (no dual-maintenance of `.github/` AI config).

## Decision

1. **Skills** → copied verbatim to `.claude/skills/` (the `SKILL.md` format is identical).
   8 skills missing `name`/`description` frontmatter were backfilled (Claude requires both).
2. **Prompts** → `.claude/commands/` (the `.prompt.md` suffix dropped; `/<name>` invokes them).
3. **Subagents** → `.claude/agents/` with a `name:` field added and an enforced `tools:`
   allow-list derived from each agent's `## Allowed Tools` section. This makes ADR-007's
   read-only/scoped-write contract **enforced by the runtime**, not merely advisory.
   (`ci-monitor-subagent` and `parity-verifier` are intentionally left unrestricted so their
   MCP/Playwright tools remain reachable.)
4. **Global instructions** → `CLAUDE.md` (the former §11 "Copilot Rules" renamed "Agent
   Rules"; the global ADR policy folded in; the nx block imported via `@AGENTS.md`).
5. **Path-scoped instructions** → nested `CLAUDE.md` files placed at each `applyTo:` target
   (e.g. `apps/webapp/CLAUDE.md`), which Claude Code auto-loads inside that subtree. The two
   multi-glob instructions also get a small pointer `CLAUDE.md` at their secondary path.
6. **Tool-name translation** across all migrated content:
   `runSubagent(name=)`→`Agent(subagent_type=)`, `read_file`→`Read`, `grep_search`/
   `semantic_search`/`vscode_listCodeUsages`→`Grep`, `file_search`/`list_dir`→`Glob`,
   `run_in_terminal`/`get_errors`→`Bash`, `create_file`→`Write`,
   `replace_string_in_file`/`insert_edit_into_file`→`Edit`, `mcp_figma_*`→`mcp__figma__*`,
   `mcp_github_*`→`mcp__github__*`.
7. **Catalog/architecture/review docs** relocated to `docs/` (`agents-catalog.md`,
   `AGENT_ARCHITECTURE.md`, `code-review-guidelines.md`).
8. **Tooling repointed:** the `agent-frontmatter-required` and `runSubagent-reference-resolves`
   checks in `scripts/lint-standards.ts`, the `SCAN_GLOBS` in `scripts/audit-example-refs.mjs`,
   and the skill paths emitted by the nx domain generator now reference `.claude/`.
9. **Removed** the Copilot AI config: `.github/{skills,prompts,agents,instructions}/`,
   `.github/copilot-instructions.md`, `.github/copilot-code-review-instructions.md`.

`runSubagent` (ADR-007) is superseded: subagents are now dispatched via the Agent tool with
`subagent_type="X"`, which resolves to `.claude/agents/X.md`. The orchestration model
(Router → Orchestrator command → Subagents; one Markdown report per subagent; no nested
dispatch) is unchanged.

## Rationale

- Claude Code only discovers `CLAUDE.md` / `.claude/**`, so without the move the entire
  knowledge layer was dead weight.
- The `SKILL.md` and subagent models map almost 1:1, so most content transferred with no
  semantic change — the work was relocation + tool-name translation, not rewriting.
- Adding `tools:` frontmatter upgrades the per-agent allow-list from aspirational prose to a
  runtime-enforced guarantee — strictly better than the Copilot setup.

## Alternatives Rejected

- **Keep both `.github/` and `.claude/`.** Rejected: dual maintenance and drift; the team
  uses Claude Code, not Copilot.
- **Thin `CLAUDE.md` pointer to `.github/`.** Rejected: Claude can't load `.github/`
  instructions/skills/agents as first-class config, so commands/subagents would not work.

## Constraints

1. New subagents go in `.claude/agents/<name>.md` with `name:`, `description:`, a `tools:`
   allow-list, and a `## Allowed Tools` section (enforced by lint).
2. New orchestrators go in `.claude/commands/`; every `Agent(subagent_type="X")` reference
   must resolve to an existing `.claude/agents/X.md` (enforced by lint).
3. New path-scoped rules go in a nested `CLAUDE.md`, not a central instructions folder.

## Enforcement (follow-up, 2026-06)

After the initial migration, stale references kept resurfacing across sessions — most often the
auto-generated **parallel AI-tool agent dirs** (`.cursor/`, `.opencode/`) that Nx/IDE tooling
re-creates, plus a hand-written Copilot tutorial (`docs/tutorial/masterclass.html`) that earlier
keyword sweeps missed. To make the migration durable rather than hope-based:

1. **Deleted + gitignored** `.cursor/` and `.opencode/` (and `.windsurf/`). `.claude/` is the single
   source of truth; the others can no longer be committed even if regenerated locally.
2. **Added a structural lint check** `no-legacy-ai-config-references` (coding-standards rule E12),
   backed by `scripts/audit-ai-config.mjs` — a `git ls-files` scan for every pre-migration signal
   (`Copilot`, old `.github/{prompts,skills,agents,instructions}/` paths, `*.prompt.md`/`*.agent.md`/
   `*.instructions.md`/`*.chatmode.md` conventions, `applyTo:` / `runSubagent(` directives, parallel
   AI dirs, and the legacy `.copilot/` spec dir) with an allowlist for this ADR, ADR-007, `.mcp.json`, and `examples/`. The repo's own spec/schema system was renamed `.copilot/` → `.specs/` for clarity (the `.copilot` name implied GitHub Copilot); the old name is now a forbidden pattern.
3. Because `pnpm lint:standards` already runs in the husky `pre-commit` + `pre-push` hooks and in
   `ci-fast-check.yml`, the guard blocks regressions at commit, push, and PR time. `pnpm audit:ai-config`
   is the single command that answers "is the migration still 100%?".

## See Also

- [ADR-007](./007-runsubagent-tool-mapping.md) — the superseded runSubagent mapping.
- [scripts/audit-ai-config.mjs](../../scripts/audit-ai-config.mjs) — the migration-completeness guard.
- [docs/AGENT_ARCHITECTURE.md](../../docs/AGENT_ARCHITECTURE.md) — three-tier model.
- [docs/agents-catalog.md](../../docs/agents-catalog.md) — subagent catalog.
- [CLAUDE.md](../../CLAUDE.md) — global project guide and conventions.
