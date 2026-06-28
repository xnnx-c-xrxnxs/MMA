---
description: Convert an estimate / sprint-planning spreadsheet (CSV) into the canonical 10-column issue-creator CSV. Auto-infers Domain, Story_Type, Effort, and Workflow from PROJECT_CONTEXT.md + issue-config.json. Preview-only — does not auto-create issues.
---

# Import Estimate CSV

You are the conversion agent that turns a project's estimate spreadsheet (typically exported from Google Sheets / Excel by the BA or PM) into the **canonical 10-column CSV** that [docs/AI_ISSUE_CREATOR_PROMPT.md](../../docs/AI_ISSUE_CREATOR_PROMPT.md) batch mode consumes.

You do NOT create issues directly. You produce a clean, reviewable CSV that the BA pastes into the standard batch flow.

---

## Phase 0 — Mandatory Pre-Flight

Read in parallel and confirm each is populated (no `[TODO:]` markers in the critical sections):

1. [.github/issue-config.json](../../.github/issue-config.json) — must contain real `domains[]` for this project (not the template examples).
2. [docs/PROJECT_CONTEXT.md](../../docs/PROJECT_CONTEXT.md):
   - **§2 Domain table** must mirror `issue-config.json`.
   - **§11 Domain Entities** must list at least one entity per domain. **If §11 is empty or only `[TODO:]`, halt** and tell the BA: "Run `/sync-notebooklm-output` first — I need entities populated to infer domains accurately."
   - **§12 Business Rules** improves accuracy but is not strictly required.
3. [docs/AI_ISSUE_CREATOR_PROMPT.md](../../docs/AI_ISSUE_CREATOR_PROMPT.md) — to know the exact 10-column output schema.

If any check fails, halt with a clear next-step instruction. Do not proceed with bad inputs.

---

## Phase 1 — Ingest the Estimate CSV

Ask the BA:

> Paste the estimate CSV inline (full content, including the header row), or give me an absolute file path I can read.
>
> Heads-up: if the spreadsheet has multiple sheets, paste only the user-stories tab — not the sprint-planning grid or the GBP totals tab.

If they give a path, use `Read`. If they paste inline, work from the message body.

---

## Phase 2 — Auto-Detect Column Mapping

Estimate spreadsheets vary in column names. Inspect the header row and propose a mapping. Show the BA exactly what you see:

```
I detected these columns in your CSV:

Source columns                  → Target column         Confidence
─────────────────────────────────────────────────────────────────
"Epic"                          → Epic                  ✅ high
"Detail" or "User Story" or "Description"
                                → User_Story            ✅ high
"Backend Low" + "Backend High"  → backend hours         ✅ high
"Frontend Low" + "Frontend High"
                                → frontend hours        ✅ high
"Version" or "Release"          → version (P3 if ≥2)    ⚠️ medium
"Risk Level" or "Risk"          → priority hint         ⚠️ medium
"Comments" + "Notes" + "Client Notes"
                                → Notes (concatenated)  ✅ high

Confirm, or correct any mapping (e.g. "Use column G for User_Story instead").
```

If a critical column (Epic OR User_Story OR any hour columns) is missing, ask the BA to identify it explicitly. Do not guess.

---

## Phase 3 — Filter Non-Story Rows

Estimate spreadsheets always contain plumbing rows. Identify and exclude:

- **Subtotal / total rows** — empty `User_Story`, or text starting with "Total", "Subtotal", "Grand total".
- **Section headers** — text in column A like `DEVELOPMENT`, `INTEGRATIONS`, `PROJECT SETUP`, `VERSIONS`, `SPRINT PLANNING`, `Other workstreams`.
- **Sprint-planning grid rows** — rows where `User_Story` is empty but hour columns are filled (these are sprint capacity entries, not work items).
- **Empty rows** — fully blank lines.
- **Infrastructure / setup tasks** — rows like "Environment Setup", "AWS Setup", "CI/CD Setup", "Deployment to Dev/Stg/Prod", "Component Creation", "Database Design and Setup". Flag these separately as **infra-chore candidates** — they should use the `/infra-chore` issue template, not user-story.

Report the filter outcome:

```
CSV breakdown:
  📝 User stories:        65
  🔧 Infra/chore tasks:    8  (will be flagged separately)
  ➖ Plumbing rows:       12  (skipped: subtotals, sprint grid, headers)
  📊 Total rows:          85

Proceed with 65 stories + 8 chores? (y / change)
```

If the user-story count is suspiciously low (< 5), halt and ask if they pasted the wrong tab.

---

## Phase 4 — Collect Default Decisions (One Question Block)

Estimate CSVs typically lack Sprint and Priority. Ask both in one message:

```
Two quick defaults:

1. Sprint planning — pick one:
   a) Auto-plan sprints for me — I'll propose groupings based on dependencies
      + effort + priority and create the milestones on GitHub. (recommended)
   b) Use one milestone for everything — tell me the name (must already exist).
   c) Use existing milestones — I'll list them; you map rows to sprints.

2. Default priority when "Risk Level" is empty or missing?
   - Critical (P0)
   - High (P1)
   - Medium (P2)  ← recommended
   - Low (P3)

Special rules I'll apply automatically:
   - Risk Level = High → P1
   - Risk Level = Low → P3
   - Version ≥ 2 (or "(Future)" in epic name) → P3 + future milestone
```

If the user picks (b) or (c), verify any named milestone exists via `gh api "/repos/{owner}/{repo}/milestones?state=open" --jq '.[].title'`. If a (b) name doesn't exist, offer to create it inline (one `gh api POST /milestones` call) instead of forcing a UI hop.

If the user picks (a), proceed to **Phase 4.5**.

---

## Phase 4.5 — Sprint Planning Pass (only if Phase 4 → option a)

Ask three short capacity questions in one block:

```
Sprint capacity:

1. How many devs on the team? (default: 2)
2. Sprint length in weeks? (default: 2)
3. Sprint capacity in story points? (default: 20)
   Sizing reference: XS=1, S=3, M=8, L=20, XL=40
```

Then compute sprint groupings using these deterministic rules:

1. **Build the dependency graph:**
   - **Tier 1 (must come first):** infra/chore rows tagged `Project Setup`, `AWS Setup`, `CI/CD`, `Cognito` → always Sprint 1.
   - **Tier 2 (foundations):** stories whose epic is `Authentication` / `Authorization` / `Login` → Sprint 1 if capacity allows, else Sprint 2.
   - **Tier 3 (domain core):** for each domain, backend stories before frontend stories (sorted by Story_Type: `Backend Only` → `Full Stack` → `Webapp Only`).
   - **Tier 4 (cross-domain integrations):** stories with `Domain = cross-domain` come **after** their dependent domains have at least one story scheduled.
   - **Tier 5 (polish / future):** `version >= 2` or `(Future)` epic → `Backlog` milestone.

2. **Bin-pack into sprints respecting capacity:**
   - Sort within each tier by Priority (P0 → P1 → P2 → P3) then by Effort descending (large items first to avoid orphan capacity at end).
   - Fill each sprint up to the declared capacity, then start the next.
   - If a single story exceeds sprint capacity (e.g. one XL = 40 in a 20-point sprint), flag it: `[REVIEW: oversized for one sprint — consider splitting]` and place it as the only item that sprint.

3. **Cap the plan at 6 active sprints + Backlog.** Anything that doesn't fit in Sprint 6 → `Backlog` milestone with a note suggesting re-prioritisation.

4. **Show the plan for confirmation:**

```
📅 Suggested sprint plan (2 devs × 2 weeks × 20 pts):

   Sprint 1  (19 / 20 pts) — Foundation: AWS, CI/CD, Cognito, login
     • [INFRA] AWS Setup                    (S)
     • [INFRA] CI/CD Setup                  (S)
     • [auth] User can sign in via SSO     (M)
     • [auth] Refresh token rotation        (S)

   Sprint 2  (20 / 20 pts) — Project domain backend
     • [project] Create project (BE)        (M)
     • [project] List projects (BE)         (S)
     • [project] Update project (BE)        (M)
     • [search] Domain entity + repository  (M)

   Sprint 3  (18 / 20 pts) — Project + Search webapp
     • [project] Create project (FE)        (S)
     • [project] List projects (FE)         (S)
     • [search] Run search (FE)             (L)

   Sprint 4 …  Sprint 5 …  Sprint 6 …

   Backlog (4 stories) — v2 features, polish
     • [project] Project archive view       (M)
     • [reporting] Weekly digest email      (L)

Proceed and create these milestones on GitHub? (y / adjust)
```

5. **On `y`:** for each sprint name and `Backlog`, call:
   ```
   gh api -X POST "/repos/{owner}/{repo}/milestones" -f title="Sprint 1" -f description="Auto-planned by /import-estimate-csv: foundation tier"
   ```
   Skip create if the milestone already exists (200 vs 422 from `gh api`). Echo the count: `✅ Created 6 milestones + Backlog`.

6. **Populate the `Sprint` column** in the canonical CSV with the assigned milestone name per row.

If the user replies `adjust`, accept free-text edits like *"move story X to Sprint 3"* or *"split Sprint 2"* and re-render the plan.

> **Note for devs:** Sprint assignments are GitHub Milestones, not labels. To move an issue to a different sprint after creation, change its milestone via the dropdown on the issue page — one click, no script needed.

---

## Phase 5 — Inference Pass

For each story row, compute the 10 canonical columns using these deterministic rules:

### `Epic`
Direct copy from source `Epic` column.

### `User_Story`
Direct copy. Strip leading/trailing whitespace. Quote if it contains a comma.

### `Domain` — **inferred**
1. Look up the Epic name in `issue-config.json` `domains[]` and `PROJECT_CONTEXT.md` §11 entity-to-domain mapping.
2. Match strategies (in order):
   - Exact substring match (Epic "Authentication & Access Control" → `auth`).
   - Entity reference in story text (story mentions "Project" → `project` domain).
   - Keyword-to-domain hints from §12 business rules.
3. If the story text or epic explicitly references entities from **2+ different domains**, set `Domain = cross-domain` and add `[CROSS-DOMAIN]` to `Notes`.
4. If no match → mark `Domain = [REVIEW: <best guess>]` and flag for Phase 6.

### `Story_Type` — **deterministic from hour columns**

| Backend high | Frontend high | Story_Type |
|---|---|---|
| > 0 | 0 | `Backend Only` |
| 0 | > 0 | `Webapp Only` |
| > 0 | > 0 | `Full Stack Backend+Webapp` |
| Story mentions "mobile" / "Expo" / "React Native" | — | `Mobile Only` or `Full Stack +Mobile` |

For `Backend Only` rows where the story body mentions SQS / events / async / publish / consume → use `Event-Driven (SQS Consumer)`.

### `Priority` — **rule-based**

```
if version >= 2 OR epic starts with "(Future)":  P3
elif risk_level == "High":                       P1
elif risk_level == "Low":                        P3
else:                                            <BA-supplied default>
```

### `Effort` — **deterministic from hours**

```
total_high = backend_high + frontend_high

if total_high <= 2:    XS
elif total_high <= 8:  S
elif total_high <= 16: M
elif total_high <= 32: L
else:                  XL
```

### `Sprint`

If Phase 4.5 sprint planning was run, use the milestone assigned by the bin-packer for this row.
Else if `version >= 2` → `Backlog` milestone (auto-create if missing).
Else → BA-supplied default from Phase 4.

### `Workflow` — **deterministic from Story_Type**

| Story_Type | Workflow |
|---|---|
| `Backend Only` | `/new-feature` |
| `Webapp Only` | `/webapp-feature` |
| `Full Stack Backend+Webapp` | `/full-stack-feature` |
| `Mobile Only` / `Full Stack +Mobile` | `/full-stack-feature` (note "+ mobile") |
| `Event-Driven (SQS Consumer)` | `/new-event-service` |
| Domain = `cross-domain` | `/full-stack-feature` (or `/new-event-service` if event-driven) |
| Infra chore | `/cd-register-service` (default) — see Phase 5b |

### `Touches` — **best-effort hint**

Generate likely path globs from the inferred domain:

| Story_Type | Likely touches |
|---|---|
| Backend Only (`screening`) | `packages/screening-domain/**, apps/screening/**` |
| Webapp Only (`project`) | `apps/webapp/src/app/projects/**, apps/webapp/src/components/projects/**` |
| Full Stack (`order`) | `packages/{domain}-domain/**, apps/{domain}/**, apps/webapp/src/app/{domain}/**` |

Always prefix with `likely:` so devs know it's a hint, not a directive.

### `Notes` — **concatenated**

Combine the source `Comments`, `Notes`, `Client Notes` columns (skip empty), then append the raw hour estimates and any flags:

```
"<source notes joined with ' | '> | est: BE 2-4h, FE 1-2h | risk: High"
```

Quote the entire field for CSV-safety.

---

## Phase 5b — Infra Chore Rows

For rows flagged as infra/chore in Phase 3, generate a parallel section in the output marked clearly:

```csv
# === INFRA / CHORE ROWS (use bug.yml or infra-chore.yml template) ===
Title,Domain,Priority,Effort,Sprint,Notes
"AWS Setup",infra,P2,S,Sprint 1,"Account setup help. est: BE 2-4h"
"CI/CD Setup",infra,P2,S,Sprint 1,"est: BE 2-4h"
```

---

## Phase 6 — Confidence Report (Show First, Bulk After)

Before emitting the full CSV, show a **first-5-rows preview** + a confidence summary:

```
PREVIEW (first 5 of 65 stories):

| # | Epic                       | Story (truncated)            | Domain  | Type        | Effort | Priority |
|---|----------------------------|------------------------------|---------|-------------|--------|----------|
| 1 | Authentication & Access... | Log in via SSO               | auth    | Full Stack  | S      | P2       |
| 2 | Authentication & Access... | Log out securely             | auth    | Full Stack  | S      | P2       |
| 3 | Authentication & Access... | Access org projects          | auth    | Backend Only| S      | P2       |
| 4 | Project Management         | Create new project           | project | Full Stack  | S      | P2       |
| 5 | Project Management         | Open existing project        | project | Full Stack  | S      | P2       |

CONFIDENCE FLAGS:
  ✅ Auto-inferred (high confidence):           58
  ⚠️ Cross-domain (please review):               4
  ⚠️ Domain inference uncertain (REVIEW marker): 2
  ❓ Story_Type ambiguous (no hour data):        1

Rows needing human review (full list):
  - Row 23: "Multi-user parallel screening" → flagged cross-domain (screening + collaboration)
  - Row 47: "Export to email" → REVIEW: best guess `notification`, alternatives: `export`, `results`
  ...

Proceed to emit the canonical CSV? (y / fix specific rows first)
```

If the BA wants to fix specific rows first, accept "Row 23: change domain to screening" style instructions and re-run Phase 6 until they approve.

---

## Phase 7 — Emit the Canonical CSV

Output the final CSV in a single fenced ```csv block. Format must match exactly what `AI_ISSUE_CREATOR_PROMPT.md` batch mode expects:

```csv
Epic,User_Story,Domain,Story_Type,Priority,Effort,Sprint,Workflow,Touches,Notes
"Authentication & Access Control","As a user, I want to log in via SSO...",auth,Full Stack Backend+Webapp,P2,S,Sprint 1,/full-stack-feature,"likely: apps/auth/**,packages/contracts/auth/**","est: BE 4-8h, FE 1h"
...
```

If there are infra-chore rows, follow with a second fenced block clearly marked.

End with the hand-off instruction:

```
✅ Canonical CSV ready (65 user stories + 8 infra chores).

Next step:
  1. Review the CSV above. Fix any rows you want to change before issuing.
  2. Open a new Claude Code session and bootstrap with:

       Please read docs/AI_ISSUE_CREATOR_PROMPT.md, docs/PROJECT_CONTEXT.md, and .github/issue-config.json.
       Repository: <owner/repo>
       Ticket prefix: <PREFIX>

  3. Once the AI says "✅ Setup complete", paste:

       Create issues from this CSV:
       <paste the CSV block above>

  4. The AI will show a batch preview. Type "Approve all" to create them.

  Why two steps? At 65+ rows, having a reviewable intermediate artifact catches mistakes before bulk creation.
```

---

## Rules

- **Preview-only.** Never call `gh issue create` from this workflow. Hand off to the standard batch flow.
- **Halt on missing context.** If `issue-config.json` or `PROJECT_CONTEXT.md` §11 isn't ready, do not guess — tell the BA to run `/sync-notebooklm-output` first.
- **Never invent domains.** Only emit domain values that exist in `issue-config.json`. Use `[REVIEW: ...]` markers for ambiguous ones.
- **Idempotent.** Re-running this on the same CSV produces the same canonical output.
- **Quote CSV fields containing commas, quotes, or newlines.** Always wrap `User_Story`, `Touches`, and `Notes` in double quotes.
