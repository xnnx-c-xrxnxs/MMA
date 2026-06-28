# 🚀 Project Bootstrap — From `gh repo create` to Ready-for-Development

> **Audience:** Tech lead or BA setting up a brand-new project from this template.
> **Time:** ~30 minutes end-to-end with NotebookLM, ~60 minutes manual.
> **Outcome:** A GitHub repo renamed, scoped, branched, ruleset-protected, label-seeded, sprint-planned, and ready for devs to run `/triage-sprint`.

---

## TL;DR — The Whole Bootstrap

```text
0. Prereqs                              (one-time per machine)
1. Create repo from template            (1 command)
2. Run ONE VS Code task                 (rename + git push + develop + rulesets + envs)
3. Install + verify build               (2 commands)
4. Extract project context              (NotebookLM, 10 min)
5. /sync-notebooklm-output              (Claude Code populates issue-config + README)
6. Seed GitHub labels                   (1 task)
7. Bulk-create + auto-plan sprints      (Claude Code /import-estimate-csv)
8. Manual GitHub UI follow-ups          (prod reviewers + CODEOWNERS access)

→ Devs run /triage-sprint and start coding.
```

Steps 1–3 take ~10 minutes. Steps 4–7 take ~20 minutes. Step 8 is two clicks in the GitHub UI.

---

## Step 0 — Prerequisites (one-time per machine)

| Tool                | Version | How to install |
|---------------------|---------|----------------|
| **Node.js**         | 24.x (Active LTS) | `nvm install 24 && nvm use 24` |
| **pnpm**            | 9.x or later | `npm install -g pnpm` |
| **GitHub CLI (`gh`)** | latest | https://cli.github.com — then `gh auth login` (choose HTTPS + browser) |
| **Claude Code**     | latest | https://claude.com/claude-code — CLI or IDE extension |
| **Docker Desktop**  | latest (only needed to run the app locally, not for bootstrap) | https://docker.com |

Verify:

```powershell
node --version          # v24.x
pnpm --version          # 9.x+
gh auth status          # "Logged in to github.com as <you>"
```

The bootstrap script (Step 2) will hard-fail with a clear error if any of these are missing or misconfigured.

---

## Step 1 — Create the repo from the template (1 min)

> ⚠️ **Use GitHub's "template" feature — NOT fork, NOT `git clone --mirror`.**
> A template-based create gives you a **fresh repo** with a single initial commit on `main` only — it deliberately does NOT inherit the template's WIP branches. A fork or mirror copies every branch + the full history of the template, which clutters your new repo.

```powershell
gh repo create your-org/your-new-project `
  --template xnnx-c-xrxnxs/mma `
  --private `
  --clone

cd your-new-project
```

That's it. The clone already has `origin` set to your new repo, on the `main` branch, with the template's tracked files intact.

> **Already created via Fork / mirror?** Delete the unwanted branches first: `git branch -r | Select-String -NotMatch 'origin/(main|HEAD)'` lists them; `git push origin --delete <branch>` removes each one. Then continue with Step 2.

---

## Step 2 — Run the one-step bootstrap task (5 min)

This is the whole rename + GitHub-wiring phase in a single VS Code task.

1. Open VS Code in the new repo: `code .`
2. Open the **Command Palette** (`Ctrl+Shift+P`) → type `Tasks: Run Task` → press Enter.
3. Pick **`Project: Bootstrap (One-Step)`**.
4. Answer the prompts:

| Prompt | Example | Notes |
|---|---|---|
| `New npm scope` | `@acme` | Must start with `@`, lowercase. Rewrites `@mma/` across all files. |
| `New project name` | `acme-platform` | Lowercase kebab-case. Replaces `mma` everywhere. |
| `CODEOWNERS team` | `@acme/platform` | The GitHub team that owns reviews. Must exist with write access. |
| `GitHub org/user` | *(blank)* | Leave blank → auto-detected from origin. Override only if URLs should point elsewhere. |
| `Display name` | *(blank)* | Leave blank → titleized from project name (`acme-platform` → `Acme Platform`). |
| `Keep examples?` | *(blank)* | Default removes `examples/`. Pick `--keep-examples` to keep the reference implementation. |
| `Skip rulesets?` | *(blank)* | Default applies branch rulesets + dev/staging/prod environments. |
| `Dry run?` | `--dry-run` first time | **Strongly recommended:** preview first, then re-run with empty (apply for real). |

The task shows the summary and prompts `Proceed? [y/N]` in the terminal — type `y` to apply.

### What this task does, in order

| Phase | Action |
|---|---|
| 1. Validate | Node 24, `gh` authed with admin, on `main`, origin exists, working tree clean. |
| 2. Rename | `@mma/` → your scope, `mma` → your name, `xnnx-c-xrxnxs` → your org, CODEOWNERS team, display strings — across every text file. |
| 2. Delete `examples/` | Unless `--keep-examples`. Also strips `paths-ignore: examples/**` from CI workflows. |
| 3. Commit + push | One commit `chore: bootstrap project from template` → `git push origin main`. |
| 4. Create `develop` | `git branch develop main && git push -u origin develop`. The CD pipeline expects this branch. |
| 5. Apply rulesets | "Protect main + develop" branch ruleset + "Protect v* tags" tag ruleset + creates `dev`, `staging`, `prod` deployment environments (with 5-min wait + self-review prevention on `prod`). |

Empty bypass lists on the rulesets — **even admins go through PR + review + CI**.

### Why a single task?

Before, this was 4 separate scripts run in sequence: rename → init branches → labels → rulesets. Each had its own gotchas (clean working tree, ordering, CODEOWNERS rename flag, etc.). The unified task handles ordering + error recovery in one place.

### Bootstrap CLI alternative (no VS Code)

```powershell
node scripts/bootstrap.mjs `
  --scope=@acme `
  --name=acme-platform `
  --owner=@acme/platform `
  --dry-run

# Then run for real (drop --dry-run)
node scripts/bootstrap.mjs `
  --scope=@acme `
  --name=acme-platform `
  --owner=@acme/platform
```

Flags: `--scope`, `--name`, `--owner` are required. `--org`, `--display-name`, `--keep-examples`, `--skip-rulesets`, `--dry-run`, `--yes` are optional. Run `node scripts/bootstrap.mjs --help` for the full list.

### What it does NOT do (intentionally — these come later)

- **Seed GitHub issue labels** — depends on `.github/issue-config.json` being filled in via `/sync-notebooklm-output` first (Step 5).
- **Self-delete `bootstrap.mjs` or `init-project.mjs`** — they stay, safe to re-run if you need to re-apply rulesets after CI workflow renames or onboard a new team.
- **Add required reviewers to `prod` environment** — Step 8 (UI click — no stable API for team-by-slug).

---

## Step 3 — Install + verify build (2 min)

```powershell
pnpm install
pnpm nx run-many -t build,test --skip-nx-cache
```

Both should succeed on a fresh clone. If anything fails here, fix it before continuing — Steps 4–7 assume a working repo.

---

## Step 4 — Extract project context with NotebookLM (10 min)

This is what makes the AI accurate. The template ships with example domains (`user`, `order`, `product`) as placeholders. Step 5 will replace them with **your project's** domains — but it needs source material first.

### If you have project documentation (BRD, specs, designs)

1. Go to [Google NotebookLM](https://notebooklm.google.com) → **Create new notebook**.
2. **Upload** all source documents (PDFs, Word, Markdown, Figma exports). More context = better extraction.
3. Open [`docs/NOTEBOOKLM_EXTRACTION_PROMPT.md`](NOTEBOOKLM_EXTRACTION_PROMPT.md) in your editor.
4. The file contains **four short prompts**. Paste them into NotebookLM one at a time (it rejects long prompts):
   - **Prompt 1** → returns `JSON_FOR_ISSUE_CONFIG` (bounded contexts)
   - **Prompt 2** → returns `MARKDOWN_PART_1_PROJECT_AND_ROLES`
   - **Prompt 3** → returns `MARKDOWN_PART_2_ENTITIES`
   - **Prompt 4** → returns `MARKDOWN_PART_3_RULES_AND_NFRS`
5. Save all four output blocks (clipboard history or a scratch file).

### If you have NO documentation yet

Skip to Step 5 — you'll hand-edit `.github/issue-config.json` and `docs/PROJECT_CONTEXT.md`. Works, but slower and less accurate.

---

## Step 5 — Apply the context via Claude Code (3 min)

1. Open Claude Code in the repo (CLI or IDE extension).
2. Make sure you're signed in.
3. Run:

   ```text
   /sync-notebooklm-output
   ```

4. Paste the four blocks from Step 4 (all together or one at a time — Claude Code will collect them).

Claude Code will:

- ✅ Validate the JSON shape.
- ✅ **Interview you about persistence (DynamoDB vs Prisma) for every domain** — NotebookLM leaves this as `[TODO]` because it's an architectural decision, not extractable from a BRD.
- ✅ Write [`.github/issue-config.json`](../.github/issue-config.json) with your domains + ticket prefix.
- ✅ Update §1, §3, §11, §12, §13 of [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).
- ✅ Upgrade the `Domain` field in all three issue templates → populated dropdown.
- ✅ Rewrite the top of [`README.md`](../README.md) with your project name, tagline, description, bounded-context list.
- ✅ List any remaining `[TODO: ...]` markers.

**Resolve `[TODO]` markers before continuing.** They appear when NotebookLM couldn't infer something — usually a 30-second team discussion. Open the affected files, fill in the blanks, save.

### Manual alternative (no NotebookLM)

Hand-edit two files:

- [`.github/issue-config.json`](../.github/issue-config.json) — replace example domains with yours (see file for shape).
- [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — fill §1 (overview), §2 (domain table), §3 (roles), §11 (entities), §12 (rules), §13 (NFRs).

---

## Step 6 — Seed GitHub issue labels (1 min)

Now that `issue-config.json` is filled in, generate the GitHub labels from it.

VS Code: **Command Palette** → `Tasks: Run Task` → **`GitHub: Seed Issue Labels`**.

Or CLI:

```powershell
node scripts/task-helpers/setup-github-labels.mjs
```

You should see ~55 labels created. Verify in the GitHub UI: **Issues → Labels** — `priority-high`, `effort-m`, `domain-<your-domain>`, `workflow-full-stack-feature`, etc.

---

## Step 7 — Bulk-create issues + auto-plan sprints (10 min)

Pick the path that matches what you have.

### Path A — You have an estimate spreadsheet (BA sprint plan)

Best path. Most projects have one.

1. Export the spreadsheet to CSV (only the user-stories tab — not totals or sprint-grid tabs).
2. In Claude Code: `/import-estimate-csv`
3. Paste the CSV.
4. Confirm the column mapping the AI proposes.
5. Pick **"a) Auto-plan sprints for me"**. Provide team size, sprint length, capacity — the AI proposes groupings.
6. Approve. The AI creates the milestones (`Sprint 1`, …, `Backlog`) and assigns each issue.
7. Review the confidence report; fix any flagged rows.
8. Claude Code emits a clean canonical CSV.
9. **In a new chat session**, paste the bootstrap message + canonical CSV (Claude Code tells you exactly what to paste).
10. Review the batch preview → `Approve all`.

### Path B — You have 1–5 stories

1. Open a new Claude Code session.
2. Paste the bootstrap message:

   ```text
   Please read docs/AI_ISSUE_CREATOR_PROMPT.md, docs/PROJECT_CONTEXT.md, and .github/issue-config.json.
   Repository: your-org/your-new-project
   Ticket prefix: <prefix from issue-config.json>
   Then tell me you're ready to help create GitHub issues.
   ```

3. Once the AI says `✅ Setup complete`, paste a user story.
4. Answer 4–6 targeted questions — AI will ask which milestone (and offer to create one inline).
5. Approve preview.

### Path C — You have a manually-written CSV

1. Format as 10 columns: `Epic, User_Story, Domain, Story_Type, Priority, Effort, Sprint, Workflow, Touches, Notes`.
2. Bootstrap a chat session as in Path B.
3. Paste: `Create issues from this CSV: <paste CSV>`.
4. Approve preview.

---

## Step 8 — Manual GitHub UI follow-ups (2 min)

These settings have no stable REST API yet — they require clicking in the GitHub UI. The bootstrap script prints the exact deep links at the end of its run.

### 8a — Add required reviewers to the `prod` environment

1. Open **Settings → Environments → prod**.
2. Tick `Required reviewers` and add a team (recommended: `release-managers`).
3. Save.

Without this, anyone with push to `main` can deploy to prod after the 5-minute wait timer expires.

### 8b — Confirm the CODEOWNERS team has write access

1. Open **Settings → Collaborators and teams**.
2. Confirm the team you put in `--owner` (e.g. `@acme/platform`) is listed with `Write` (or higher) access.

If the team doesn't have write access, every PR will fail the code-owner-review requirement.

---

## ✅ You're Done

You now have:

- ✅ Repo renamed, scoped, with examples removed (or kept, your choice).
- ✅ `main` + `develop` branches pushed to origin.
- ✅ Branch rulesets + tag rulesets + `dev`/`staging`/`prod` environments.
- ✅ Project-specific GitHub labels.
- ✅ Project-specific `PROJECT_CONTEXT.md` + `issue-config.json` + updated `README.md`.
- ✅ AI-planned sprint backlog with milestones auto-created.
- ✅ Required reviewers on `prod`.

Devs can now run `/triage-sprint` in Claude Code to pick what to work on next.

---

## Developer Daily Loop (post-bootstrap)

```text
/triage-sprint                              # AI scores + bundles open issues
↓
"Recommended next: /full-stack-feature ABC-42"
↓
/full-stack-feature ABC-42                  # workflow walks dev through implementation
↓
PR + CI passes → merge
↓
back to /triage-sprint for next pick
```

Full developer reference: [`CLAUDE.md`](../CLAUDE.md) (Golden Rules + skill mapping + workflow catalogue).

---

## Re-Running After Project Changes

| When | What to re-run |
|---|---|
| BRD updated, new domain added | Step 4 (NotebookLM) → Step 5 (`/sync-notebooklm-output`) → Step 6 (re-seed labels). All idempotent. |
| New sprint planning CSV | Step 7 Path A — proposes updates to existing milestone plan. |
| You added a domain via `/new-domain` workflow | Step 6 (re-seed labels) — picks up the new `domain-*` label automatically. |
| CI workflow job names changed | Re-run `Project: Bootstrap (One-Step)` (it's idempotent), or run `Tasks: Run Task → GitHub: Setup Branch Protection` directly. |
| Sprint scope changed mid-cycle | Adjust each issue's milestone via GitHub UI dropdown, or re-run Step 7 Path A on the updated CSV. |
| You created another project from the template | Steps 0–8 from scratch. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Bootstrap fails: `Node 24+ required` | Wrong Node version active | `nvm use 24` (or install: `nvm install 24`) |
| Bootstrap fails: `gh is not authenticated` | `gh auth login` not run | `gh auth login` (HTTPS + browser) |
| Bootstrap fails: `Not inside a git repository` | Ran outside the cloned repo | `cd your-new-project` first |
| Bootstrap fails: `No 'origin' remote` | Manual `git init` instead of `gh repo create --template` | Re-create the repo via `gh repo create --template`, or `git remote add origin <url>` then re-run |
| Bootstrap fails: `Working tree not clean` | Local edits present | `git stash` first, or commit them |
| Bootstrap fails: `You don't have admin` | `gh` user lacks admin on the repo | Re-auth as repo owner, or pass `--skip-rulesets` and have an admin run setup-branch-protection separately |
| `/sync-notebooklm-output` says `Missing issue-config.json` | Step 5 never ran | Run `/sync-notebooklm-output` (or hand-edit the file) |
| Issue templates show `Domain` as free-text | Step 5 not run | Run `/sync-notebooklm-output` |
| `prod` deployments don't ask for reviewer approval | Step 8a skipped | Add required reviewers at `Settings → Environments → prod` |
| `gh label create` returns 403 | `gh` user lacks repo write access | `gh auth login` with the right account |
| `/import-estimate-csv` doesn't offer auto-sprint-planning | Picked option (b) or (c) instead of (a) | Re-run, pick `(a) Auto-plan sprints for me` |
| `/import-estimate-csv` halts: `§11 entities required` | Steps 4–5 not done, or §11 still has `[TODO:]` markers | Complete Steps 4 and 5 first |
| Claude Code doesn't see `/sync-notebooklm-output` | Slash commands not loaded | Restart Claude Code (or reload the editor window) so it re-scans `.claude/commands/` |

---

## File Map (for reference)

| File | What it does |
|---|---|
| [`scripts/bootstrap.mjs`](../scripts/bootstrap.mjs) | The one-step orchestrator (Step 2) |
| [`scripts/init-project.mjs`](../scripts/init-project.mjs) | Rename engine (called by `bootstrap.mjs`; also usable standalone) |
| [`scripts/task-helpers/setup-branch-protection.mjs`](../scripts/task-helpers/setup-branch-protection.mjs) | Rulesets + environments (called by `bootstrap.mjs`; also usable standalone) |
| [`scripts/task-helpers/setup-github-labels.mjs`](../scripts/task-helpers/setup-github-labels.mjs) | Label seeder (Step 6) |
| [`scripts/task-helpers/init-branches.mjs`](../scripts/task-helpers/init-branches.mjs) | Standalone develop-branch creator (superseded by `bootstrap.mjs`; kept for re-runs) |
| [`scripts/remove-examples.mjs`](../scripts/remove-examples.mjs) | Standalone `examples/` remover (if you kept it during bootstrap and want it gone later) |
| [`.github/issue-config.json`](../.github/issue-config.json) | Project domains + ticket prefix (filled by Step 5) |
| [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Project context the AI reads (filled by Step 5) |
| [`docs/NOTEBOOKLM_EXTRACTION_PROMPT.md`](NOTEBOOKLM_EXTRACTION_PROMPT.md) | Prompt for Google NotebookLM (Step 4) |
| [`docs/AI_ISSUE_CREATOR_PROMPT.md`](AI_ISSUE_CREATOR_PROMPT.md) | AI instructions for creating issues |
| [`.claude/commands/sync-notebooklm-output.md`](../.claude/commands/sync-notebooklm-output.md) | The `/sync-notebooklm-output` workflow |
| [`.claude/commands/import-estimate-csv.md`](../.claude/commands/import-estimate-csv.md) | The `/import-estimate-csv` workflow |
| [`.claude/commands/triage-sprint.md`](../.claude/commands/triage-sprint.md) | The `/triage-sprint` workflow |
| [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/) | GitHub issue forms (user-story, bug, infra-chore) |
