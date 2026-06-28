# ADR-007: `runSubagent(name=...)` maps to Claude Code's native subagent runner

**Status:** SUPERSEDED (by ADR-008)
**Date:** 2026-05

> **Superseded 2026-06 by [ADR-008](./008-migrate-ai-config-to-claude-code.md).** The
> repo's AI configuration moved from GitHub Copilot (`.github/`) to Claude Code
> (`.claude/` + `CLAUDE.md`). The `runSubagent(name="X")` directive is now the Agent
> tool with `subagent_type="X"`, resolving to `.claude/agents/X.md`. The architectural
> intent (context isolation + enforced per-agent tool allow-list) is unchanged and is now
> additionally enforced by each agent's `tools:` frontmatter. The two lint checks were
> repointed to `.claude/`. This document is retained as a historical record.

## Context

`.claude/commands/*.md` orchestrators reference subagents via a textual directive in the prompt body:

```
Run `domain-explorer` with parameters: domain={domain}, focus=all
```

Until 2026-05 this was a **convention** — the main agent read the directive, found the corresponding `.claude/agents/{name}.md` file, and followed its instructions in its own context. There was no actual tool call. Two problems followed:

1. **No context isolation.** The "subagent's" instructions were loaded into the main agent's context, defeating the original goal of keeping the main thread small.
2. **No tool allow-list enforcement.** Read-only audit agents (`dependency-auditor`, `golden-rule-validator`) could in principle call write tools because the main agent's tools were not narrowed.

Claude Code ships a native subagent runner (the Agent tool, `subagent_type="X"`) that:
- Spawns a fresh agent with its own context.
- Resolves the `name` to a `.claude/agents/{name}.md` file.
- Returns the subagent's final message as the tool result.

## Decision

`runSubagent(name="X", prompt="...")` directives in `.claude/commands/*.md` resolve to the native `runSubagent` tool. The main agent **must** invoke that tool — it is no longer allowed to read the agent file and follow it inline.

To enforce this:

1. **Lint check `runSubagent-reference-resolves`** in [scripts/lint-standards.ts](../../scripts/lint-standards.ts) ensures every `runSubagent(name="X")` reference points to an existing `.claude/agents/X.md` file.
2. **Lint check `agent-frontmatter-required`** ensures every `.claude/agents/*.md` file ships the required `description` frontmatter and an `## Allowed Tools` section, so the runtime can enforce the allow-list.
3. The `## Allowed Tools` section is the contract — any tool not listed must be rejected by the subagent.

## Rationale

- The native tool provides **context isolation** for free, restoring the original architectural intent.
- The tool allow-list is now enforceable rather than aspirational.
- Existing prompts and agents need **zero changes** — the textual `runSubagent(...)` directive shape was already chosen to match the tool's signature.
- Adding the two lint checks means drift is caught at CI time, not at runtime.

## Alternatives Rejected

- **Inline expansion (status quo before 2026-05).** Continue reading the agent file inline. Rejected: defeats context isolation and makes the allow-list aspirational.
- **A separate runner script.** Build a Node.js wrapper that spawns subagents out of band. Rejected: Claude Code ships this natively; adding our own would diverge from the platform.
- **Pseudo-tool with shell escape.** Encode subagent invocations as shell commands. Rejected: violates `operationalSafety` rules and provides no isolation.

## Constraints

1. Every prompt that uses `runSubagent(name="X")` MUST reference an existing agent file. Enforced by lint.
2. Every agent file MUST declare its tool allow-list under `## Allowed Tools`. Enforced by lint.
3. Subagents MUST return a single Markdown report — never raw tool transcripts.
4. Parallel `runSubagent` calls in one orchestrator turn are dispatched concurrently by the main agent.
5. If a subagent fails or returns no output, the main agent must surface that failure to the developer — never silently continue.

## See Also

- [docs/AGENT_ARCHITECTURE.md](../AGENT_ARCHITECTURE.md) — three-tier model
- [docs/agents-catalog.md](../agents-catalog.md) — catalog with allow-list summary
