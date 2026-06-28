# Agent Architecture — Three-Tier Model

> **Status:** Active. Last updated 2026-05.
> **Audience:** Engineers extending the workspace's AI-native workflow.
> **For the agent catalog see** [docs/agents-catalog.md](./agents/README.md).

---

## The Three Tiers

```
┌────────────────────────────────────────────────────────────────┐
│  Tier 1 — ROUTER                                                │
│  orchestrator-router.md                                   │
│                                                                 │
│  • Classifies free-text user intent.                            │
│  • Recommends a slash command. NEVER auto-dispatches.           │
│  • Output: one suggestion + optional alternatives.              │
└──────────────────────────┬─────────────────────────────────────┘
                           │  developer types `yes` or a slash command
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Tier 2 — ORCHESTRATOR PROMPTS                                  │
│  .claude/commands/*.md                                    │
│                                                                 │
│  • Drive a complete workflow (interview → plan → execute).      │
│  • Spawn subagents at fan-out points via Agent().         │
│  • Aggregate subagent outputs and present to user.              │
│  • Examples: /full-stack-feature, /figma-import, /triage-sprint │
└──────────────────────────┬─────────────────────────────────────┘
                           │  Agent(subagent_type="X", prompt="...")
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Tier 3 — SUBAGENTS                                             │
│  .claude/agents/*.md                                      │
│                                                                 │
│  • Single-purpose, isolated context.                            │
│  • Tool allow-list enforced in frontmatter.                     │
│  • Either fully read-only OR scoped-write.                      │
│  • Output: one Markdown report. Never raw tool dumps.           │
└────────────────────────────────────────────────────────────────┘
```

---

## Data-Flow Rules

1. **Information flows up.** Subagents report to orchestrators; orchestrators report to the developer. The router never receives subagent output.
2. **Decisions flow down.** Orchestrators decide which subagents to spawn and in what order. Subagents never spawn other subagents.
3. **Subagent outputs are Markdown — always.** Never JSON, never raw tool transcripts. Aggregation is structural, not parsing-based.
4. **Parallel subagents do not share state.** If two subagents need the same data, the orchestrator gathers it once and passes it to both via the `prompt` argument.
5. **No subagent has unbounded scope.** Every agent file declares either a `scope` parameter (read-only audit) or a write allowlist (build agent). Lint check `Agent-reference-resolves` prevents drift.

---

## Three Roles a Subagent Can Play

### Role A — Discovery (Phase 0 / 0.5)

Spawned **before** any code is written. Read-only. Returns context the orchestrator uses to decide what to build.

Examples: `domain-explorer`, `contract-diff-analyzer`, `prompt-skill-loader`, `event-flow-tracer`.

### Role B — Build (Scoped-Write)

Spawned **during** execution, in parallel with other build agents. Has write access to a strict folder allowlist.

Examples: `webapp-builder` (writes `apps/webapp/`), `mobile-builder` (writes `apps/mobile/`).

### Role C — Validation (Post-Build)

Spawned **after** code is written, before the developer is asked to review. Read-only. Each produces a pass/fail report.

Examples: `golden-rule-validator`, `dependency-auditor`, `security-reviewer`, `test-coverage-analyzer`.

### Composition

At the end of a workflow, **result-aggregator** receives the outputs of all Role C agents (and the Role B reports) and composes one unified status. **pr-summary-writer** then drafts the PR description from that aggregated report + the diff.

---

## How Orchestrators Spawn Subagents

Inside a `.claude/commands/*.md` file, the orchestrator instructs the main agent in plain text:

```
Run `domain-explorer` with parameters:
  domain={domain}
  focus=all
  thoroughness=medium
```

The main agent then:
1. Calls `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=all, thoroughness=medium")`.
2. Receives the subagent's Markdown report.
3. Either continues the workflow or fans out further subagents in parallel.

Parallel fan-out is expressed in the prompt as a bullet list of `Agent` calls in one block — the main agent dispatches them concurrently and waits for all results before continuing.

---

## Subagent vs Skill vs Slash Command

| | Subagent | Skill | Slash Command |
|---|---|---|---|
| **File** | `.claude/agents/X.md` | `.claude/skills/X/SKILL.md` | `.claude/commands/X.md` |
| **Triggered by** | Orchestrator prompt via `Agent` | Main agent or orchestrator, loaded via `Read` | Developer typing `/X` |
| **Context** | Isolated (fresh) | Loaded into main agent's context | Loaded into main agent's context |
| **Output** | One Markdown report | Inline instructions the main agent follows | Workflow execution |
| **Tool allow-list** | Enforced via frontmatter | Loose — follows main agent's tools | Loose — follows main agent's tools |
| **When to use** | Read-only audit OR parallel scoped-write builder | A reusable pattern / template / contract | A complete workflow with interview + execution |

---

## Why This Architecture

| Problem | Solution |
|---|---|
| Main agent's context fills up with 10+ skill / source files | `prompt-skill-loader` returns one digest; `domain-explorer` summarises in place of reading 12 files |
| Web + mobile work serialised → slow | `webapp-builder` + `mobile-builder` run in parallel after backend freeze |
| Golden Rules drift undetected until PR review | `golden-rule-validator` runs automatically at end of every workflow |
| OWASP-class bugs surface in code review | `security-reviewer` runs before PR opens |
| Developer has to write a "what changed" summary by hand | `result-aggregator` + `pr-summary-writer` do it |
| 27 prompts → "which one should I run?" overload | Router classifies intent → recommends one |
| Subagent name typos break workflows silently | `Agent-reference-resolves` lint check |

---

## Adding a New Subagent

1. Decide which Role (A / B / C) it plays.
2. Confirm an orchestrator prompt will actually spawn it. **Agents that no prompt spawns are dead code.**
3. Create `.claude/agents/{name}.md` with required frontmatter and `## Allowed Tools` section (see [docs/agents-catalog.md](./agents/README.md)).
4. Update the spawning orchestrator(s) to call `Agent(subagent_type="{name}", ...)`.
5. Add a row in [docs/agents-catalog.md](./agents/README.md) catalog.
6. Run `pnpm tsx scripts/lint-standards.ts` — confirms frontmatter and reference integrity.

## See Also

- [docs/agents-catalog.md](./agents-catalog.md) — full catalog with descriptions
- [docs/decisions/007-runsubagent-tool-mapping.md](./decisions/007-runsubagent-tool-mapping.md) — how `Agent` maps to a real tool
- [CLAUDE.md](../CLAUDE.md) §11 — workflow entry points table
