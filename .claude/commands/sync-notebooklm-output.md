---
description: Apply NotebookLM extraction output to .github/issue-config.json, docs/PROJECT_CONTEXT.md, and README.md. Accepts the four blocks produced by docs/NOTEBOOKLM_EXTRACTION_PROMPT.md (one at a time or all together), interviews you per-domain about persistence (DynamoDB vs Prisma), and rewrites the README header for the new project.
---

# Sync NotebookLM Output

You are the merge agent for project bootstrap. The user has run [docs/NOTEBOOKLM_EXTRACTION_PROMPT.md](../../docs/NOTEBOOKLM_EXTRACTION_PROMPT.md) against their project documents in Google NotebookLM (which now produces FOUR small blocks instead of two big ones) and is about to paste the resulting blocks. Your job is to collect them, validate them, interview the user about persistence per domain, and apply them to this repository.

---

## Phase 0 — Mandatory Pre-Flight

Before doing anything, read in parallel:

1. [docs/NOTEBOOKLM_EXTRACTION_PROMPT.md](../../docs/NOTEBOOKLM_EXTRACTION_PROMPT.md) — to know the expected schema of all four blocks.
2. [.github/issue-config.json](../../.github/issue-config.json) — current state.
3. [docs/PROJECT_CONTEXT.md](../../docs/PROJECT_CONTEXT.md) — current state.
4. [README.md](../../README.md) — current state (only the top section will be rewritten).
5. [scripts/task-helpers/setup-github-labels.mjs](../../scripts/task-helpers/setup-github-labels.mjs) — to confirm the script reads `domains[]` from the JSON.

---

## Phase 1 — Collect the Four Blocks

Tell the user:

> Paste the blocks NotebookLM produced. There are FOUR labelled blocks:
> 1. ` ```JSON_FOR_ISSUE_CONFIG ` (Prompt 1)
> 2. ` ```MARKDOWN_PART_1_PROJECT_AND_ROLES ` (Prompt 2)
> 3. ` ```MARKDOWN_PART_2_ENTITIES ` (Prompt 3)
> 4. ` ```MARKDOWN_PART_3_RULES_AND_NFRS ` (Prompt 4)
>
> You can paste them all in one message, or one block per message — I'll wait until I have all four. If you only have some right now, paste what you have and I'll prompt for the rest.

Accept blocks one or many at a time. Track which of the four labels you've received. After each user message:

- Identify any new fenced blocks by their label.
- Confirm receipt and list which labels are still missing.
- If at least one block is missing, say: `Still need: <list>. Paste when ready, or type "skip <label>" to apply only what I have.`

If the user types `skip <label>`, drop that block from the apply set and proceed. Partial application is allowed AS LONG AS Block 1 (`JSON_FOR_ISSUE_CONFIG`) is present — without it, persistence interview and label seeding cannot run.

If Block 1 is missing, halt with: `Cannot proceed without JSON_FOR_ISSUE_CONFIG (Prompt 1). Re-run NotebookLM and paste at minimum that block.`

---

## Phase 2 — Validate Block 1 (JSON)

Parse the JSON block. Validate:

- ✅ `projectName` is a non-empty kebab-case string. If `[TODO: ...]`, ask the user for the value now.
- ✅ `ticketPrefix` is 2–5 uppercase letters. If `[TODO: ...]`, ask the user for the value now.
- ✅ `domains` is a non-empty array.
- ✅ Every `domains[].name` is lowercase, singular, no spaces. Reject `users`, `User`, `order management`.
- ✅ Every `domains[].description` is a non-empty short sentence.
- ✅ `crossCutting` exists and includes at least `webapp`, `mobile`, `infra`, `cross-domain`, `new-domain`.

It is EXPECTED that every `domains[].persistence` is `"[TODO: dynamodb or prisma]"` — that is what NotebookLM is told to emit. Phase 2.5 resolves it.

If any domain conflicts with template-fixed cross-cutting surfaces (`auth`, `files`, `monitoring`), warn the user — those are template-provided and should usually NOT be modelled as project domains.

---

## Phase 2.5 — Persistence Interview (PER-DOMAIN)

For every domain whose `persistence` is `"[TODO: ...]"` (or anything other than `"dynamodb"` / `"prisma"`), interview the user. Use the `vscode_askQuestions` tool to present ALL outstanding domains in a single multi-question batch (one question per domain). For each domain:

- **Header:** `persistence-<domain-name>`
- **Question:** `Persistence for "<domain-name>" — DynamoDB or Prisma/PostgreSQL?`
- **Message:** Include the domain's description AND the decision rubric:
    > **DynamoDB OneTable** — best for key-value access, predictable access patterns, high read throughput, serverless-first. Cursor pagination.
    >
    > **Prisma + PostgreSQL** — best for relational data, joins, aggregates, ACID transactions, complex reporting. Offset pagination.
    >
    > Default suggestion: <suggest `dynamodb` if the domain looks lookup-heavy from its description, otherwise `prisma`>.
- **Options:**
    - `{ label: "dynamodb", description: "OneTable, cursor pagination, key-value", recommended: <true if dynamo suggested> }`
    - `{ label: "prisma", description: "PostgreSQL, offset pagination, joins/aggregates", recommended: <true if prisma suggested> }`
- **allowFreeformInput:** `false` (hard either-or)

Apply each answer to the in-memory JSON before writing to disk. Show the user a confirmation summary before proceeding:

```
Persistence decisions:
  - user      → dynamodb
  - product   → dynamodb
  - order     → prisma
  - invoice   → prisma
Proceeding to write issue-config.json…
```

---

## Phase 3 — Validate Markdown Blocks (2, 3, 4 — only those received)

For each Markdown block received, validate the section headers it contains:

- **MARKDOWN_PART_1_PROJECT_AND_ROLES** must contain:
  - `## 1. What This Project Is`
  - `## 3. User Roles`
- **MARKDOWN_PART_2_ENTITIES** must contain:
  - `## 11. Domain Entities`
- **MARKDOWN_PART_3_RULES_AND_NFRS** must contain:
  - `## 12. Project-Specific Business Rules`
  - `## 13. Project-Specific Integrations & NFRs`

None of the blocks may contain `## 4.`, `## 5.`, `## 6.`, `## 7.`, `## 8.`, `## 9.`, `## 10.` (those are template-fixed). If any of those appear, drop them silently and warn the user that NotebookLM strayed outside scope.

Surface every `[TODO: ...]` marker in a single bullet list to the user — they may want to fill some in immediately.

---

## Phase 4 — Apply Block 1 (JSON)

Replace the entire contents of [.github/issue-config.json](../../.github/issue-config.json) with the validated JSON (with persistence values now resolved). Preserve the top-level `_comment` array if it exists in the current file (re-attach it after the JSON object's other keys, or merge it in).

Run `Bash` on the file. If JSON is malformed, undo and ask the user to re-paste.

---

## Phase 5 — Apply Markdown Blocks

Open [docs/PROJECT_CONTEXT.md](../../docs/PROJECT_CONTEXT.md). Update sections in place — but ONLY for blocks that were actually received in Phase 1:

- If `MARKDOWN_PART_1_PROJECT_AND_ROLES` received → replace § 1 and § 3.
- If `MARKDOWN_PART_2_ENTITIES` received → replace § 11 (append if absent).
- If `MARKDOWN_PART_3_RULES_AND_NFRS` received → replace §§ 12 and 13 (append if absent).
- ALWAYS regenerate the **§ 2 table** rows from `issue-config.json` `domains[]` so it stays in sync with Block 1. Keep the source-of-truth note above the table. Use the resolved persistence values (`DynamoDB OneTable` or `Prisma + PostgreSQL`).
- **Leave § 4, 5, 6, 7, 8, 9, 10 untouched** — they are template-fixed.

---

## Phase 6 — Upgrade Issue Template Domain Field to a Dropdown

The three issue templates ship with the `Domain` field as a free-text `type: input` so brand-new clones of this template don't show stale example domains. After bootstrap, upgrade it to a populated `type: dropdown`.

For each of:

- [.github/ISSUE_TEMPLATE/user-story.yml](../../.github/ISSUE_TEMPLATE/user-story.yml)
- [.github/ISSUE_TEMPLATE/bug.yml](../../.github/ISSUE_TEMPLATE/bug.yml)
- [.github/ISSUE_TEMPLATE/infra-chore.yml](../../.github/ISSUE_TEMPLATE/infra-chore.yml)

Locate the `id: domain` form field and replace the entire field block (whether it's currently `type: input` or `type: dropdown`) with a `type: dropdown` whose `options:` list contains every `domains[].name` followed by every `crossCutting[].name` from the new `issue-config.json`. Preserve the field's `label`, `description` (drop the "After running `/sync-notebooklm-output`..." hint — it's now obsolete), and `validations: required: true`.

```yaml
  - type: dropdown
    id: domain
    attributes:
      label: "Domain"
      description: "Which bounded context does this touch?"
      options:
        - "<domains[0].name>"
        - "<domains[1].name>"
        ...
        - "<crossCutting[0].name>"
        ...
      default: 0
    validations:
      required: true
```

This is idempotent — re-running this workflow always rewrites the dropdown to match the current `issue-config.json`.

---

## Phase 7 — Rewrite README.md Header for the New Project

The repo's [README.md](../../README.md) ships hardcoded for the `mma` itself. After bootstrap it must reflect the actual project — otherwise visitors land on a README about the template, not the product.

Rewrite ONLY the top of `README.md` — everything from the file start through (and including) the `## What's in the box` bullet list. Do NOT touch the rest (Quick Start, Documentation table, AI Agents section, License, Contributing — those remain template-managed and accurate).

Replace with the following structure (substitute placeholders from `issue-config.json` and PROJECT_CONTEXT.md § 1):

```markdown
# {projectName}

> {Purpose sentence from PROJECT_CONTEXT.md § 1, or "TODO: project tagline" if § 1 was not provided}

## About this project

{Description paragraph from PROJECT_CONTEXT.md § 1, or "TODO: fill in project description" if § 1 was not provided}

**Bounded contexts:**
- `{domain[0].name}` — {domain[0].description} ({domain[0].persistence === "prisma" ? "Prisma + PostgreSQL" : "DynamoDB OneTable"})
- `{domain[1].name}` — ...

## What's in the box (template baseline)

This project is built on **mma**, which provides:

- **Backend bounded contexts** with Clean Architecture (NestJS on Lambda)
- **Dual persistence**: DynamoDB OneTable + Prisma/PostgreSQL
- **Cross-context patterns**: synchronous ACL, async events, choreography sagas
- **Frontend**: Next.js webapp + Expo mobile sharing one data-access layer
- **Observability**: structured logging + OpenTelemetry + X-Ray + correlationId end-to-end
- **Internal monitoring tool**: in-house dashboard for traces, alarms, metrics
- **Deployment**: Lambda + shared API Gateway + ECS/Lambda webapp, all driven by `.github/service-registry.json`
- **CI/CD**: GitHub Actions with OIDC, affected detection, preview environments, branch protection
- **AI-native**: 50+ task-scoped Claude Code skills + workflow orchestrators
```

Preserve everything from `## Quick Start` onwards untouched. The boundary to detect is the line `## Quick Start` — do NOT modify it or anything after it.

If MARKDOWN_PART_1_PROJECT_AND_ROLES was NOT received in Phase 1, still rewrite the header — but use `[TODO: project tagline]` and `[TODO: project description]` placeholders, and warn the user. The point is to overwrite the `# mma` title so the new project no longer claims to be the template.

After writing, run `Bash` on `README.md`.

---

## Phase 8 — Run the Label Seed Task

Tell the user:

> ✅ All files updated. Final step — seed the GitHub labels:
>
> ```
> Run VS Code task: `GitHub: Seed Issue Labels`
> ```
>
> or from a terminal:
>
> ```
> node scripts/task-helpers/setup-github-labels.mjs
> ```
>
> The script will create `domain-<name>` labels for every domain you just defined.

---

## Phase 9 — Final Verification

Run, in parallel:

- `Bash` on `.github/issue-config.json`, `docs/PROJECT_CONTEXT.md`, `README.md`, and the three issue template YAMLs.
- A `Grep` for `[TODO:` across `docs/PROJECT_CONTEXT.md` and `README.md` so the user sees what still needs human input.

Report a one-screen summary:

- Project name + ticket prefix.
- Domains added / changed / removed (with resolved persistence per domain).
- Roles documented.
- Entities documented.
- Business rules count.
- README header rewritten? (yes/no)
- Outstanding `[TODO:]` markers (with file + line).

---

## Rules

- **Idempotent.** Re-running this workflow with the same inputs must produce the same files.
- **Partial application allowed.** If only some blocks are pasted, apply what's there and leave the rest as-is. Block 1 (`JSON_FOR_ISSUE_CONFIG`) is the only hard requirement.
- **Persistence is interactive, never inferred from NotebookLM output.** Always run Phase 2.5 against `vscode_askQuestions` for any unresolved persistence value.
- **Non-destructive on template-fixed sections.** Never touch §2 narrative below the table, §4–10 of PROJECT_CONTEXT.md, anything in README.md from `## Quick Start` onwards, or any file outside the listed surfaces.
- **Halt on validation errors.** Do not partially apply Block 1 if its JSON is malformed. The user can re-paste.
- **Never invent.** If NotebookLM produced placeholder text, surface it as a `[TODO]` — never guess.
