# Quick Start — Creating Issues with AI

> **Audience:** Business Analysts, Product Owners, anyone scoping work for the team.
> **Goal:** Create well-structured GitHub issues that flow cleanly into the developer's `/triage-sprint` workflow.

---

## What You Need (Once)

1. **Claude Code** (CLI or IDE extension) installed and signed in.
2. **GitHub CLI** (`gh`) authenticated (`gh auth status` returns "Logged in").
3. The repository cloned locally and open in your editor.
4. **Project-specific labels seeded** — see "Adapting This Template to a New Project" below if this is the first sprint.

---

## Adapting This Template to a New Project

When you clone this template into a new repo, the BA / tech lead must do this **once**:

### Step 0 — Extract project context from your source documents (recommended)

If you have BRDs, specs, design docs, or meeting notes, use Google NotebookLM to auto-extract the project-specific bits:

1. Upload all source documents to [Google NotebookLM](https://notebooklm.google.com).
2. Open [docs/NOTEBOOKLM_EXTRACTION_PROMPT.md](NOTEBOOKLM_EXTRACTION_PROMPT.md) and paste the prompt block into NotebookLM's chat.
3. NotebookLM returns two paste-ready blocks (`JSON_FOR_ISSUE_CONFIG` and `MARKDOWN_FOR_PROJECT_CONTEXT`).
4. Open Claude Code and run **`/sync-notebooklm-output`**, then paste the two blocks. Claude Code validates them and writes them to `issue-config.json` + `PROJECT_CONTEXT.md` + the three issue template YAMLs in one shot — including converting the `Domain` field from free-text input to a populated dropdown.
5. Skip directly to Step 4 below.

If you have **no source documents**, do Steps 1–4 manually instead.

> **Filing issues mid-bootstrap is safe.** The cloned template ships with the `Domain` field as a free-text input, not a dropdown of stale example domains. BAs can file issues at any time — they just type the domain name and the AI Issue Creator validates it against `issue-config.json`. The dropdown only appears after `/sync-notebooklm-output` runs.

### Step 1 — Edit `.github/issue-config.json`

Replace the example `domains[]` (`user`, `order`, `product`, etc.) with your project's actual bounded contexts. Set `projectName` and `ticketPrefix`.

### Step 2 — Update `docs/PROJECT_CONTEXT.md`

Edit §1 (project overview), §2 (domain table), §3 (user roles), and add §11–13 (entities, business rules, NFRs) so the AI describes your project correctly.

### Step 3 — (Optional) Upgrade the `Domain` field to a dropdown

If you want a dropdown instead of free-text in the GitHub UI, edit the `id: domain` field in:
- `.github/ISSUE_TEMPLATE/user-story.yml`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/infra-chore.yml`

Change `type: input` to `type: dropdown` and add an `options:` list mirroring your `issue-config.json` `domains[]` + `crossCutting[]`. (Or just run `/sync-notebooklm-output` once — it does this automatically.)

### Step 4 — Seed labels

Run the VS Code task **`GitHub: Seed Issue Labels`** (or `node scripts/task-helpers/setup-github-labels.mjs`). The script reads `issue-config.json` and creates `domain-*` labels for every domain you defined.

### Step 5 — Create your first Milestone

In the GitHub UI, create your first sprint milestone (e.g. `Sprint 1`) so BAs have somewhere to assign issues.

After that one-time setup, the daily flows below work exactly the same regardless of project.

---

## The Three-File System

| File | What it does |
|---|---|
| [docs/AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md) | The instructions you give the AI to drive issue creation. |
| [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | The factual snapshot of this codebase (domains, roles, tech stack). The AI reads this so you don't have to repeat yourself. |
| [.github/ISSUE_TEMPLATE/user-story.yml](../.github/ISSUE_TEMPLATE/user-story.yml) | The structured form fields the AI fills in. |

---

## Workflow A — Single Story (1–5 issues)

### Step 1 · Open Claude Code and bootstrap the session

Paste this once per chat session:

```
Please read docs/AI_ISSUE_CREATOR_PROMPT.md and docs/PROJECT_CONTEXT.md.

Repository: xnnx-c-xrxnxs/<your-repo>
Ticket prefix: OST

Then tell me you're ready to help create GitHub issues.
```

The AI will respond with `✅ Setup complete` and ask you to share a user story.

### Step 2 · Share the user story

```
I want to create an issue:

As a customer,
I want to cancel my pending order,
so that I can stop a mistaken purchase.
```

### Step 3 · Answer 4–6 targeted questions

The AI will only ask for things it cannot infer from `PROJECT_CONTEXT.md`. Typical questions:

- Story type (Backend / Webapp / Mobile / Full Stack / Infra)?
- Priority (Critical / High / Medium / Low)?
- Effort (XS / S / M / L / XL)?
- Sprint (Milestone)?
- Specific acceptance scenarios?
- Files this likely touches?

### Step 4 · Review the preview

The AI shows a complete issue preview. Reply with:

- **`Approve`** → AI creates the issue immediately on GitHub.
- **`Change [section]`** → AI updates that section and shows a new preview.

### Step 5 · Done

The AI prints the GitHub URL. The issue is now visible to the team and pickable by `/triage-sprint`.

---

## Workflow B — Batch CSV (10+ issues, sprint planning)

### Step 1 · Prepare your CSV

Required columns:

```csv
Epic,User_Story,Domain,Story_Type,Priority,Effort,Sprint,Workflow,Touches,Notes
```

See [docs/AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md) — section "Mode 2 — Batch CSV Mode" — for the full column reference and a sample CSV.

### Step 2 · Bootstrap the session (CSV variant)

```
Please read docs/AI_ISSUE_CREATOR_PROMPT.md and docs/PROJECT_CONTEXT.md.

I'm in Batch CSV Mode.
Repository: xnnx-c-xrxnxs/<your-repo>
Ticket prefix: OST

Here is my CSV:

[paste CSV content]
```

### Step 3 · Confirm 2 settings

The AI will ask:
1. Show 1–2 sample previews? (yes / no)
2. Approve to create all `<N>` issues?

### Step 4 · Approve once → all issues created

The AI creates the first issue (this triggers a one-time MCP approval prompt — click **"Allow for this conversation"**), then auto-creates the rest with progress updates.

### Step 5 · Review the summary

You get a table with every issue URL, grouped by Sprint and Epic. Skipped rows (validation errors) are listed separately.

---

## What Happens Next (Developer Side)

Once issues exist with the right labels (`priority-*`, `effort-*`, `domain-*`, `workflow-*`) and are assigned to a Milestone:

1. Developer opens Claude Code and types **`/triage-sprint`**.
2. AI fetches sprint issues, scores them, bundles related ones.
3. AI recommends a workflow prompt per bundle (e.g. `/full-stack-feature`).
4. Developer picks a bundle and runs the recommended `/<prompt>`.
5. The orchestrator drives the implementation through phases, loading the right skills.
6. Developer opens a PR with `Closes #142, Closes #143, Closes #144` — bundle merges atomically.

You don't need to do anything in this part — just make sure issues have the required labels and Milestone.

---

## What the AI Will Not Do

- **It will not create issues without your explicit "Approve".**
- **It will not assign developers** — leave that to the dev team or `/triage-sprint`.
- **It will not change Milestone after creation** — set the Sprint field correctly the first time.
- **It will not pick `Critical` priority unless you say so.**
- **It will not write code** — issue creation only.

---

## Common Issues & Fixes

| Problem | Fix |
|---|---|
| AI keeps asking for the domain list | `PROJECT_CONTEXT.md` may not be read — paste the bootstrap message again. |
| Created issue has no labels | Your `Story_Type`, `Priority`, `Effort`, or `Workflow` value didn't match the dropdown. Check the AI prompt's allowed values. |
| Created issue not in a sprint | `Sprint` column was empty or didn't match an existing Milestone exactly. Create the Milestone in GitHub first. |
| `/triage-sprint` skips your issue | It's labelled `blocked` or has an unresolved `Blocked by: #NNN`. |
| MCP approval prompt asks per issue | First time only — click **"Allow for this conversation"**. |

---

## Need More Detail?

- Full AI instructions: [docs/AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md)
- Project facts: [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Architecture rules: [CLAUDE.md](../CLAUDE.md)
- Developer triage workflow: [.claude/commands/triage-sprint.md](../.claude/commands/triage-sprint.md)
