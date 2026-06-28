---
description: "Identify high-priority sprint issues, group related ones into cohesive bundles, and recommend a workflow prompt per bundle. USE WHEN user says 'what should I work on', 'triage', 'pick my next issue', 'plan my sprint', 'bundle issues', 'what issues can I bundle', or 'help me plan today's work'."
---

# Sprint Triage & Bundling — Guided Workflow

You are orchestrating issue selection for a developer. Your job is to:

1. Pull open issues from the active sprint.
2. Filter and rank by priority, blockers, and effort.
3. Group related issues into **bundles** that can be tackled with a single workflow prompt.
4. Recommend the workflow prompt per bundle.
5. Let the developer choose which bundle to start.

**Do NOT generate code, create branches, or invoke another workflow prompt during this run.** This prompt's only output is a triage report and a final question.

---

## Phase 0 — Interview

Ask the following in a single structured message via `vscode_askQuestions` and wait for answers.

### Required Information

1. **Sprint milestone** — exact GitHub milestone title (e.g. `Sprint 26`). Default: active milestone (most recent open milestone).
2. **Scope** — `me` (issues assigned to me) | `team` (any unassigned + mine) | `all` (every open sprint issue). Default: `me`.
3. **Max combined effort per bundle** — `s` | `m` | `l` | `xl`. Default: `l`.
4. **Domain focus (optional)** — restrict to one or more of `user`, `order`, `product`, `auth`, `files`, `webapp`, `mobile`, `infra`. Default: no filter.
5. **Number of bundles to propose** — `1`–`5`. Default: `3`.

**Do not proceed until questions 1–5 are answered.**

---

## Phase 1 — Fetch Issues

Use the GitHub MCP tools (load via `tool_search` if not yet loaded). **You MUST follow every step in this phase in order. Do NOT skip the milestone-number resolution. Do NOT include any issue you remember from prior conversations, training data, or other repositories — only issues returned by the live API calls in this phase are eligible.**

### 1.1 — Resolve repo identity

Infer `owner` and `repo` from the workspace's git remote (`git remote get-url origin`). If ambiguous, ask the developer once and stop until answered. **Never guess the owner/repo from issue titles or memory.**

### 1.2 — Resolve the milestone title to a milestone NUMBER

The GitHub REST API filters issues by milestone **number**, not title. Passing a title string causes the API to silently return ALL open issues for the repo — which is the root cause of "issues outside the sprint" hallucinations.

Steps:

1. Call `mcp__github__list_issues` with `type: "milestone"` (or use the milestones listing if the tool exposes one) to fetch all open milestones for `{owner}/{repo}`.
2. Find the milestone whose `title` **exactly matches** the developer's answer (case-sensitive, trimmed).
3. Record its numeric `number` field (e.g. `26`) and its `due_on` date.
4. **If no exact match is found, STOP.** Report the available milestone titles to the developer and ask them to pick one. Never proceed with a guess or a fuzzy match.

If the MCP tool surface does not expose a milestone listing, fall back to `Bash` with:
`gh api "repos/{owner}/{repo}/milestones?state=open" --jq '.[] | {number, title, due_on}'`

### 1.3 — Fetch issues filtered by milestone NUMBER

Call `mcp__github__list_issues` with:
- `owner`, `repo`
- `state: "open"`
- `milestone: <resolved number as string>` — e.g. `"26"`, NOT `"Sprint 26"`
- `assignee` filter derived from scope (`@me` for `me`, omit for `team`/`all`)
- `perPage: 100` and paginate until exhausted

### 1.4 — Verify every fetched issue (mandatory filter step)

For each issue returned:

1. Call `mcp__github__issue_read` to get the full issue body and the embedded `milestone` object.
2. **Drop the issue if `issue.milestone?.number !== <resolved number>`.** This is a hard filter — never include an issue whose milestone field does not match the resolved number, regardless of labels, title, or assignee.
3. Drop the issue if `issue.state !== "open"`.
4. Drop pull requests (`issue.pull_request` is set).

Record the **exact count** of issues that survived this filter. You will report this number in Phase 5. If the count is `0`, skip directly to Phase 5 and produce an empty report — **do not fabricate issues to fill bundles.**

### 1.5 — Forbidden sources

You MUST NOT include any issue from:

- Memory of previous conversations.
- Training data or examples in this repository's `examples/` or `docs/` folders.
- A different repository, even if forked from this one.
- A different milestone, even if higher priority.

If you find yourself "remembering" an issue number that didn't come from the §1.3 fetch, drop it.

---

## Phase 2 — Parse & Classify

For each issue extract (label format matches `docs/AI_ISSUE_CREATOR_PROMPT.md`):

| Field | Source |
|---|---|
| `priority` | label `priority-critical` / `priority-high` / `priority-medium` / `priority-low` (default `priority-low` if missing) |
| `effort` | label `effort-xs` / `effort-s` / `effort-m` / `effort-l` / `effort-xl` (default `effort-m` if missing) |
| `domain` | label `domain-{name}` (e.g. `domain-order`, `domain-webapp`, `domain-cross-domain`) |
| `layer` | label(s) `layer-backend` / `layer-webapp` / `layer-mobile` / `layer-infra` |
| `type` | label `user-story` / `type-bug` / `type-chore` |
| `story_type` | label `story-type-*` |
| `workflow_hint` | label `workflow-{kebab}` (e.g. `workflow-full-stack-feature`) |
| `parent_or_sub` | label `parent-issue` / `sub-issue` (if present) |
| `blocked_by` | parse the `Blocked by` body field — one `#NNN` per line |
| `touches` | parse the `Touches` body field — one glob per line |
| `is_blocked` | label `blocked` OR any `blocked_by` issue still open |
| `security_sensitive` | `true` if any of: label `security` / `auth` / `secrets`, OR `touches` includes `apps/auth/**` / `infrastructure/clients/**` / `**/jwt*` / `**/cookie*` / `infra/modules/secrets/**`. Used in Phase 5 to flag bundles that should run `security-reviewer` during their workflow. |

**Drop** any issue where `is_blocked = true`.

**Sub-issue collapsing rule:** for each `parent-issue` in the milestone, look up its `Sub-Issues:` list (parsed from the parent body). Then:

- If **all** sub-issues are still open → drop the sub-issues, surface the parent (routes to `/full-stack-feature`). The work hasn't started.
- If **some** sub-issues are closed and others are open → drop the parent, surface the open sub-issues individually so each one routes to its own per-layer prompt (`/webapp-feature` for `layer-webapp` sub-issues, `/new-feature` for `layer-backend` sub-issues, etc.). This is the "BE merged, FE pending" case — exactly when an FE dev needs to see only the FE slice.
- If **all** sub-issues are closed → the parent is effectively done; surface it only if it has its own residual checklist items, otherwise skip.

---

## Phase 3 — Score & Rank

Compute per issue:

```
priority_weight = { critical: 100, high: 50, medium: 20, low: 5 }[priority]
effort_penalty  = { xs: 0, s: 1, m: 3, l: 7, xl: 15 }[effort]
score           = priority_weight - effort_penalty
```

Sort descending by `score`.

---

## Phase 4 — Bundle

Apply these rules in order to group ranked issues into bundles:

### Bundle WHEN

- Same `domain` AND same or compatible `workflow_hint`.
- `touches` globs overlap (same package or app folder).
- Combined effort ≤ user's `max_bundle_effort` answer.
- All bundle members are `user-story` or `type-chore` together (don't mix `type-bug` hotfixes with feature work; don't mix infra with feature).
- All members have the same "frontend visibility" — backend-only stays with backend-only; full-stack stays with full-stack.

### DO NOT bundle WHEN

- Different domains AND no shared contract.
- Any member is labelled `breaking-contract` and the others aren't (isolate breaking changes).
- One member needs a Prisma migration and another doesn't (migration risk).
- Combined effort exceeds `max_bundle_effort`.
- A member depends on another bundle's output (would create blocking).

### Workflow Prompt Mapping

Pick the most specific prompt that covers all members of the bundle. Match against the `workflow-*` label first; fall back to inference from `story-type-*` + `domain-*`.

| Bundle signature | Recommended prompt |
|---|---|
| `workflow-new-domain` | `/new-domain` |
| `workflow-new-domain-dynamo` | `/new-domain-dynamo` |
| `workflow-quick-crud-domain` | `/quick-crud-domain` |
| `workflow-full-stack-feature` OR (backend + webapp + mobile sub-issues sharing a parent) | `/full-stack-feature` |
| `workflow-webapp-feature` OR (only `domain-webapp` / `layer-webapp` members) | `/webapp-feature` |
| `workflow-new-feature` + single backend domain | `/new-feature` |
| `workflow-new-use-case` + single use case | `/new-use-case` |
| `workflow-new-service` | `/new-service` |
| `workflow-new-event-service` OR `domain-cross-domain` async | `/new-event-service` |
| `workflow-mobile-release` | `/mobile-release` |
| `workflow-new-e2e-tests` | `/new-e2e-tests` |
| `workflow-fe-accessibility-pass` | `/fe-accessibility-pass` |
| `workflow-add-push-notifications` | `/add-push-notifications` |
| `workflow-new-ui-primitive` | `/new-ui-primitive` |
| `workflow-add-monitoring-feature` | `/add-monitoring-feature` |
| `workflow-add-alerting` | `/add-alerting` |
| `workflow-infra-new-module` OR `workflow-cd-register-service` | No orchestrator — direct work via `infra-new-module` / `cd-register-service` skills |
| Mixed / unclear | No single prompt — list candidates and let developer choose |

Generate up to `N` bundles (user's answer to Q5). Singletons are valid bundles.

### Mode A vs Mode B (frontend bundles only)

For every bundle whose recommended prompt is `/webapp-feature` (or any FE-only prompt — `/new-ui-primitive`, `/fe-accessibility-pass`), classify it:

- **Mode A — frontend-only.** All bundle members satisfy ALL of:
  - `layer-webapp` and/or `layer-mobile` only — no `layer-backend`, no `layer-infra`.
  - `Touches:` globs do NOT include `packages/contracts/**`, `packages/{domain}-domain/**`, `apps/{domain}/{service}/**`, `infra/**`, or `.github/service-registry.*`.
  - No `breaking-contract` label on any member.
- **Mode B — backend changes required.** Any member fails the Mode A test. The `/webapp-feature` prompt's Phase 0 will detect this and redirect to `/new-feature` or `/full-stack-feature`. Surface this in the report so the dev knows up front.

For non-FE prompts (`/new-feature`, `/new-domain`, `/full-stack-feature`, etc.), do not assign a mode — leave the field blank in the report.

---

## Phase 5 — Output

Produce a Markdown report with this exact structure:

```markdown
# Sprint Triage — <milestone title> (#<milestone number>, <scope>)

**Resolved milestone:** `<title>` → number `<N>` (due `<due_on>`)
**API filter used:** `milestone=<N>` on `repos/<owner>/<repo>/issues`
**Total open issues returned by API:** <N>
**Issues dropped by milestone-number verification (§1.4):** <N>
**Total open issues considered:** <N>
**Blocked / skipped:** <N> (list IDs)
**Bundles proposed:** <N>

---

## Bundle 1 — <short descriptive title>

**Recommended prompt:** `/<prompt>`
**Mode:** A — frontend-only / B — backend changes required / — (n/a for non-FE prompts)
**Local infra:** not required (skip `Infra: Start All`) — *Mode A only; otherwise omit*
**Combined effort:** <xs/s/m/l/xl>
**Domains:** <list>
**Risks:** <breaking-contract / migration / cross-service / none>
**🔒 Security review flagged:** <yes (run `security-reviewer` during this workflow) / no — only present when any bundle member has `security_sensitive = true` from Phase 2>

| # | Title | Priority | Effort | Domain | Why grouped |
|---|-------|----------|--------|--------|-------------|
| #142 | ... | p1 | m | order | shared contract with #144 |
| #144 | ... | p1 | s | webapp | same slice |

**Suggested branch name:** `feature/142-144-<slug>`

---

## Bundle 2 — ...

---

## Unbundled high-priority issues
(issues that scored well but didn't fit any bundle — listed individually with their own recommended prompt)

| # | Title | Priority | Effort | Recommended prompt |
|---|-------|----------|--------|---------------------|
| #150 | ... | p0 | xl | `/new-domain` |
```

---

## Phase 6 — Final Question

End with exactly this message:

```
Which bundle would you like to start?

Reply with the bundle number (e.g. "1") and I will:
  1. Stop this triage workflow.
  2. Hand off to the recommended prompt for that bundle.
  3. Pre-fill the interview answers from the issue bodies where possible.

Or reply "none" to refine the triage criteria.
```

**If the chosen bundle is Mode A**, append this block before the developer types the slash command:

```
This bundle is frontend-only (Mode A):
  • Skip "Infra: Start All" — no LocalStack / Postgres / NestJS services needed.
  • Set NEXT_PUBLIC_API_*_URL in .env.local to the deployed dev URLs.
  • Run only "Service: Serve webapp" (and "Service: Serve mobile" if mobile is in scope).
  • /webapp-feature will run in Mode A and auto-skip backend-related phases.
  • See docs/ai-native-workflow-quickstart.md — "Daily Flow — Frontend-only".
```

**If the chosen bundle is Mode B** (FE prompt but backend changes detected), append:

```
This bundle was routed to a frontend prompt but touches backend files (Mode B):
  • Run /new-feature (single domain) or /full-stack-feature (multi-domain) instead.
  • Backend services must be running locally OR you can target a deployed dev API
    once the BE slice is merged.
```

**Do not invoke the next workflow prompt yourself.** The developer must explicitly type the slash command (e.g. `/full-stack-feature`) in a follow-up message. This keeps the triage step auditable and reversible.

---

## Rules

1. **Read-only.** This prompt never writes files, creates branches, comments on issues, or pushes code.
2. **No assumptions about missing labels.** If an issue lacks `priority:*` or `effort:*`, default per Phase 2 and flag it in the report under a "Metadata gaps" footnote so the team can backfill.
3. **Respect the milestone — by NUMBER, not title.** Always resolve title → number via Phase 1.2 and filter via `issue.milestone?.number` in Phase 1.4. Never include an issue whose `milestone.number` does not match the resolved value, even if higher priority, even if its labels suggest it belongs to the sprint, and even if you recall it from a previous run.
4. **Surface blockers.** Always list dropped/blocked issues so the developer knows why they're not in a bundle.
5. **Be deterministic.** Same inputs should produce the same bundling on a re-run within the same sprint.
6. **No fabrication.** If §1.3 returns zero issues for the milestone, the final report has zero bundles. Do not invent issues, do not pull from other milestones to "fill" the sprint, and do not reuse issue numbers from memory.
