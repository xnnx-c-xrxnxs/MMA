# GitHub Issue Creator — Step-by-Step Runbook

> **Audience:** Tech leads bootstrapping a new project, BAs filing issues, devs picking them up.
> **Goal:** Go from "I just cloned the template" → "BAs are filing AI-generated issues and devs are running `/triage-sprint`."

---

## Phase 1 — One-Time Project Bootstrap (Tech Lead, ~15 min)

### Step 1 · Install prerequisites

```powershell
node --version          # must be 24.x (run `nvm use` after cloning)
gh --version            # GitHub CLI
gh auth status          # must say "Logged in"
pnpm --version          # 9.x or later
```

If `gh` isn't authenticated: `gh auth login`.

### Step 2 · Open the repo in Claude Code

- Install **Claude Code** (CLI or IDE extension) and sign in.
- Open the workspace.

### Step 3 · Extract project context with NotebookLM (recommended)

If you have BRDs, specs, or design docs:

1. Go to [Google NotebookLM](https://notebooklm.google.com) and create a new notebook.
2. Upload all source documents (BRDs, specs, architecture diagrams, meeting notes).
3. Open [docs/NOTEBOOKLM_EXTRACTION_PROMPT.md](NOTEBOOKLM_EXTRACTION_PROMPT.md) and copy the prompt block (between the ```` ```` fences).
4. Paste it into NotebookLM's chat.
5. NotebookLM returns **two fenced blocks**:
   - `JSON_FOR_ISSUE_CONFIG`
   - `MARKDOWN_FOR_PROJECT_CONTEXT`
6. Copy both blocks into your clipboard or a scratch file.

**Skip this step** if you have no source documents — you'll do Step 4 manually.

### Step 4 · Apply the extraction with Claude Code

Open Claude Code and run:

```
/sync-notebooklm-output
```

Paste both blocks when prompted. Claude Code will:

- Validate the JSON structure.
- Write [.github/issue-config.json](../.github/issue-config.json) with your real domains.
- Update §1, §3, §11, §12, §13 of [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
- Upgrade the `Domain` field in all three issue templates from free-text → populated dropdown.
- Surface any `[TODO: ...]` markers for you to fill in.

**No NotebookLM?** Manually edit `issue-config.json` (set `projectName`, `ticketPrefix`, replace `domains[]`) and `PROJECT_CONTEXT.md` (§1, §2 table, §3 roles, add §11–13).

### Step 5 · Seed GitHub labels

Run the VS Code task: **`GitHub: Seed Issue Labels`**

Or from a terminal:

```powershell
node scripts/task-helpers/setup-github-labels.mjs
```

The script reads `issue-config.json` and creates ~55 labels on the GitHub repo, including one `domain-<name>` label per project domain.

### Step 6 · Create your first sprint milestone

In the GitHub UI: **Issues → Milestones → New Milestone** → name it `Sprint 1` (or whatever your team uses).

### Step 7 · Commit and push

```powershell
git add .github/ docs/
git commit -m "chore: bootstrap project-specific issue creator"
git push
```

**Bootstrap complete.** All BAs and devs can now use the daily workflows below.

---

## Phase 2 — BA Daily Workflow (Single Issue)

### Step 1 · Open Claude Code and bootstrap the session

Paste **once per chat session**:

```
Please read docs/AI_ISSUE_CREATOR_PROMPT.md, docs/PROJECT_CONTEXT.md, and .github/issue-config.json.

Repository: <your-org>/<your-repo>
Ticket prefix: <prefix from issue-config.json>

Then tell me you're ready to help create GitHub issues.
```

The AI responds with `✅ Setup complete`.

### Step 2 · Share the user story

Free-form is fine:

```
I want to create an issue:

As a customer,
I want to cancel my pending order,
so that I can stop a mistaken purchase.
```

### Step 3 · Answer 4–6 targeted questions

The AI infers what it can from `PROJECT_CONTEXT.md` and only asks for what's truly missing — typically:

- Story type (Backend / Webapp / Mobile / Full Stack / Infra)
- Priority (P0 / P1 / P2 / P3)
- Effort (XS / S / M / L / XL)
- Sprint (which milestone)
- Specific acceptance scenarios
- Files this likely touches

### Step 4 · Review the preview

The AI shows the complete issue preview (title, body, labels, milestone). Reply:

- **`Approve`** → AI creates the issue on GitHub immediately.
- **`Change [section]`** → AI updates that section and re-shows.

### Step 5 · Done

The AI prints the GitHub URL. The issue is now visible to the team and pickable by `/triage-sprint`.

---

## Phase 3 — BA Batch Workflow (10+ issues from a CSV)

### Step 1 · Bootstrap the session (same as Phase 2 Step 1)

### Step 2 · Paste your CSV inline

```
Create issues from this CSV:

Epic,User_Story,Domain,Story_Type,Priority,Effort,Sprint,Workflow,Touches,Notes
Onboarding,"As a guest I want to sign up so I can start using the app",user,Full Stack Backend+Webapp,P1,M,Sprint 1,/full-stack-feature,"apps/webapp/src/app/auth/sign-up,packages/{domain}-domain","email verification required"
Onboarding,"As a user I want to verify my email so I can activate my account",user,Backend Only,P1,S,Sprint 1,/new-feature,"packages/{domain}-domain","sends SQS event"
...
```

### Step 3 · Approve the batch preview

The AI shows a table of all issues. Reply:

- **`Approve all`** → creates them all.
- **`Skip rows 3, 5`** / **`Edit row 7`** → tweak the batch.

---

## Phase 4 — Developer Workflow (Pick Up an Issue)

### Step 1 · Triage the sprint

In Claude Code:

```
/triage-sprint
```

The AI fetches open issues in the active milestone, scores them by `priority - effort`, bundles related ones, and recommends a workflow prompt for the highest-scoring item.

### Step 2 · Run the recommended workflow

The triage output ends with something like:

> **Recommended next:** `/full-stack-feature OST-42`

Type that command. The matching workflow prompt takes over and walks you through implementation phase by phase.

---

## Re-Running After Project Changes

| Trigger | Re-run |
|---|---|
| New BRD, new domain, scope change | Phase 1 Steps 3–5 (NotebookLM → `/sync-notebooklm-output` → seed labels). All idempotent. |
| New domain added by `/new-domain` | Edit `issue-config.json` `domains[]`, then re-run **`GitHub: Seed Issue Labels`** task and `/sync-notebooklm-output` to refresh the dropdowns. |
| You created another project from the template | Whole Phase 1 again. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `❌ Missing .github/issue-config.json` from label seed task | Phase 1 Step 4 not done | Run `/sync-notebooklm-output` or hand-edit the JSON |
| Issue templates show `Domain` as free-text instead of dropdown | `/sync-notebooklm-output` hasn't run yet | Either run it, or manually upgrade the field per Phase 1 Step 4 |
| AI Issue Creator picks wrong domain for a story | `PROJECT_CONTEXT.md` §11 (entities) is sparse | Add more entity detail or re-run NotebookLM extraction |
| `gh label create` returns 403 | `gh` user lacks repo write access | `gh auth login` with the right account |
| Milestone not found when creating issue | First sprint milestone not created | Phase 1 Step 6 |

---

## File Reference

| File | Purpose |
|---|---|
| [.github/issue-config.json](../.github/issue-config.json) | Source of truth for project domains, ticket prefix, labels |
| [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Factual snapshot the AI reads first |
| [docs/AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md) | Instructions the BA pastes to drive the AI |
| [docs/NOTEBOOKLM_EXTRACTION_PROMPT.md](NOTEBOOKLM_EXTRACTION_PROMPT.md) | Prompt for Google NotebookLM |
| [docs/QUICK_START_BA.md](QUICK_START_BA.md) | Full BA-facing guide |
| [.claude/commands/sync-notebooklm-output.md](../.claude/commands/sync-notebooklm-output.md) | `/sync-notebooklm-output` workflow |
| [.claude/commands/triage-sprint.md](../.claude/commands/triage-sprint.md) | `/triage-sprint` workflow |
| [.github/ISSUE_TEMPLATE/user-story.yml](../.github/ISSUE_TEMPLATE/user-story.yml) | User story form |
| [.github/ISSUE_TEMPLATE/bug.yml](../.github/ISSUE_TEMPLATE/bug.yml) | Bug form |
| [.github/ISSUE_TEMPLATE/infra-chore.yml](../.github/ISSUE_TEMPLATE/infra-chore.yml) | Infra/chore form |
| [scripts/task-helpers/setup-github-labels.mjs](../scripts/task-helpers/setup-github-labels.mjs) | Label seed script |
