---
description: "Extract and document a source project for migration into mma — runs read-only discovery across stack, routes, data model, components, and tokens, then classifies/dedups components, synthesizes bounded-context domains as rich Markdown, recommends DynamoDB-vs-Prisma per domain, maps tokens to the two-tier design system, generates a user-story CSV + project-context brief + backend runbook, and reconciles a coverage ledger. Produces NO spec YAML and writes NO production code — only analysis artifacts under {source}-migration/. USE WHEN the user says 'migrate this project', 'extract this repo into the template', 'analyze this source app for migration', 'port this codebase'."
---

# Source Project → Migration Extract

You are orchestrating the **extraction phase** of a project migration. You ingest a source repository (any stack — Vite/React, Next, CRA, etc.) and produce a complete set of **analysis artifacts** that document how it maps onto mma's Nx Clean-Architecture structure. The companion prompt `/migrate-build-ui` later builds the no-auth preview UI from these artifacts.

**This phase writes ONLY Markdown/CSV analysis artifacts under `{source}-migration/`. It does NOT generate spec YAML, does NOT build production code, and does NOT touch the backend.** Domains/pages are documented as rich Markdown; the developer later runs the separate spec/`/new-domain`/`/webapp-feature` workflows.

**This workflow is split into two explicit phases the developer MUST approve between:**

- **Phase A — PLAN (read-only)**: profiles the source repo and produces an execution plan. STOPS for approval.
- **Phase B — EXECUTE**: runs the discovery → classification → synthesis → reconciliation pipeline, with one approval gate (Gate #1) and one confirmation step (DB recommendations).

**Do NOT call any tools or write any artifacts until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **Source repository path?** (absolute path, e.g. `d:\mma-flow`)
2. **Source slug?** Short kebab name used for the output folder and preview surface (e.g. `mma-flow`). Output root becomes `{source-slug}-migration/`.
3. **Router / framework hint?** (e.g. `react-router-dom v6`, `next-app-router`, `unknown` — helps the route cataloguer). Default `unknown` (auto-detect).
4. **Data-layer hint?** (e.g. `supabase + sql migrations`, `prisma`, `rest api`, `unknown`). If SQL migrations exist, they are treated as the **authoritative data model**. Default `unknown`.
5. **Milestone/sprint hint for user stories?** (e.g. `Sprint 1`, or `none` to leave unassigned). Default `none`.
6. **Scope?** Choose one:
   - **Full** _(default)_ — all routes, all domains, all components, tokens, stories, context, runbook.
   - **Analysis-only** — stop after domains + components classification (skip stories/context/runbook).

**Do not proceed until questions 1–2 are answered.** The rest take defaults if omitted.

---

## Phase 0.5 — Pre-flight Discovery (parallel, read-only)

Run in parallel:

- Confirm the source path exists and read its `package.json` (or equivalent manifest) to detect language/build/deps.
- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: new-domain-package, add-contracts, dynamo-repository, prisma-repository, new-dynamo-schema, new-prisma-schema, webapp-new-page, webapp-api-client-hooks, fe-design-tokens, contracts-subpath-imports")`
- Read `packages/ui/src/index.ts` — inventory of existing `@mma/ui` primitives (for classifier reuse decisions).
- Read `packages/design-tokens/src/lib/tokens.ts` — target token inventory.

Wait for all to return.

---

## PHASE A — PLAN (read-only)

This phase **MUST NOT WRITE ANY ARTIFACTS**. Output is a single approval document.

### A.1 — Profile the source repo

`Agent(subagent_type="source-stack-profiler", prompt="Profile source at {sourceRoot}. Detect language/build, UI framework, routing, state, data layer, BaaS, styling, component lib, forms, testing. Map each to the mma target. DRY RUN: report findings only, do not write STACK.md yet. migrationRoot={migrationRoot}")`

### A.2 — Produce the execution plan

From the profile, present a Markdown plan listing:

| Stage               | Subagent(s)                                                                                                                  | Output artifact(s)                                                                                                        | Est. items                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 0 Discovery         | source-stack-profiler, source-route-cataloguer, source-domain-prospector, source-component-inventory, source-token-extractor | STACK.md, routes/, domains/\_candidates.md, components/\_raw-inventory.md (incl. Story Matrix), tokens/\_source-tokens.md | routes / components / tables counts |
| 1 Classify & dedup  | component-classifier, domain-synthesizer                                                                                     | components/\_classification.md, domains/INDEX.md + domain-{name}.md                                                       | —                                   |
| 2 DB recommendation | (domain-synthesizer output)                                                                                                  | per-domain DynamoDB/Prisma rec                                                                                            | —                                   |
| 3 Token mapping     | token-mapper                                                                                                                 | tokens/\_mapping.md, tokens.patch.ts                                                                                      | —                                   |
| 4 Stories + context | user-story-extractor, project-context-synthesizer                                                                            | issues/user-stories.csv, FEATURES_AND_USER_STORIES.md, context/PROJECT_CONTEXT.md                                         | —                                   |
| 5 Runbook           | project-context-synthesizer                                                                                                  | RUNBOOK.md                                                                                                                | —                                   |
| 6 Reconciliation    | coverage-auditor                                                                                                             | LEDGER.md, PARITY.md, \_reconciliation-extract.md                                                                         | —                                   |

### A.3 — STOP for approval

End with: _"Reply `approve` to run extraction, or request changes to scope."_ **Do not proceed to Phase B without explicit approval.**

---

## PHASE B — EXECUTE (after approval)

### Stage 0 — Discovery (parallel fan-out, read-only)

Run these five subagents in parallel. Each writes its own artifact; none overlaps:

- `Agent(subagent_type="source-stack-profiler", prompt="Write STACK.md. sourceRoot={sourceRoot} migrationRoot={migrationRoot}")`
- `Agent(subagent_type="source-route-cataloguer", prompt="Enumerate every navigable surface (routes, nested routes, tab-in-route, modal-only, auth/role gates, 404/error/loading). Write routes/INDEX.md + route-{slug}.md per surface and SEED the ledger with each at status=discovered. sourceRoot={sourceRoot} migrationRoot={migrationRoot} routerHint={routerHint}")`
- `Agent(subagent_type="source-domain-prospector", prompt="Treat DB migrations as the authoritative data model (chunked reads; final cumulative schema wins). Cross-reference feature code for behaviour. Write domains/_candidates.md and recommend DynamoDB vs Prisma per candidate. No spec YAML. sourceRoot={sourceRoot} migrationRoot={migrationRoot} dataLayerHint={dataLayerHint}")`
- `Agent(subagent_type="source-component-inventory", prompt="Exhaustively inventory every component (primitive vs composite) with props/variants/states/tokens/data-deps/composed-of/usage-count, cross-checked vs routes. ALSO harvest the Story Matrix from each sibling .stories.tsx/.stories.ts/.stories.mdx (story export names + concrete variant/size/intent/state values + storiesRef), tagging each component stories=present (authoritative) or stories=inferred (fallback). Write components/_raw-inventory.md (incl. the Story Matrix section) + composite cards under components/composites/ and add each component to the ledger at status=discovered. sourceRoot={sourceRoot} migrationRoot={migrationRoot} uiLibHint={uiLibHint}")`
- `Agent(subagent_type="source-token-extractor", prompt="Harvest source tokens verbatim (color/spacing/typography/radius/elevation/motion) from config + CSS vars + theme files. Infer semantic intent. Flag dark-only tokens needing light counterparts. Write tokens/_source-tokens.md. sourceRoot={sourceRoot} migrationRoot={migrationRoot} stylingHint={stylingHint}")`

After all return, confirm the ledger is seeded (every route + component + candidate-domain = `discovered`).

### Stage 1 — Classification & Synthesis

Run in parallel:

- `Agent(subagent_type="component-classifier", prompt="Cluster duplicate components by structural similarity + usage count, pick a canonical representative, decide REUSE(@mma/ui)/BUILD-PRIMITIVE/BUILD-COMPOSITE/DROP, assign weights, and reconcile the ledger (mapped→reuse|mapped→build|dropped — nothing stays discovered). Write components/_classification.md. migrationRoot={migrationRoot} sourceRoot={sourceRoot} templateRoot={templateRoot}")`
- `Agent(subagent_type="domain-synthesizer", prompt="Finalize candidate contexts into per-domain rich Markdown in target Clean-Architecture vocabulary (constants, entity+invariants+state transitions, use cases, repository interface, persistence recommendation with GSI/index design, endpoints, events, authorization, evidence, completeness). Include a DynamoDB-vs-Prisma recommendation with rationale per domain. Write domains/INDEX.md + domain-{name}.md. No spec YAML. migrationRoot={migrationRoot} sourceRoot={sourceRoot}")`

#### GATE #1 — Developer review (STOP)

Present a concise summary of `components/_classification.md` (reuse/build/drop counts + dedup clusters) and `domains/INDEX.md` (bounded contexts + per-domain DB recommendation). Ask the developer to:

1. Approve or adjust the component classification (override any dedup/drop).
2. **Confirm the DynamoDB-vs-Prisma recommendation for each domain.**

Record confirmed DB choices in the ledger and each `domain-{name}.md`. **Do not proceed without sign-off.**

### Stage 3 — Token mapping

`Agent(subagent_type="token-mapper", prompt="Map source tokens → two-tier @mma/design-tokens by intent, synthesize light counterparts for dark-only tokens, flag unmapped, check WCAG AA contrast. PROPOSE (do not apply) a tokens.ts patch and note the pnpm tokens:gen post-step. Write tokens/_mapping.md + tokens.patch.ts. migrationRoot={migrationRoot} templateRoot={templateRoot}")`

### Stage 4 — User stories + Project context (skip if scope = analysis-only)

Run in parallel:

- `Agent(subagent_type="user-story-extractor", prompt="Convert domains/routes/behaviours into epics + user stories. Emit the canonical 10-column CSV (Epic,User_Story,Story_Type,Domain,Effort,Priority,Milestone/Sprint,Notes,Labels,Prompt) for /import-estimate-csv + the AI_ISSUE_CREATOR pipeline, with the Prompt column referencing concrete downstream workflows. Write issues/user-stories.csv + FEATURES_AND_USER_STORIES.md. migrationRoot={migrationRoot} sourceRoot={sourceRoot} milestoneHint={milestoneHint}")`
- `Agent(subagent_type="project-context-synthesizer", prompt="Distill purpose/actors/glossary/workflows/business-rules/integrations/NFRs into a PROJECT_CONTEXT brief, and produce a backend RUNBOOK (dependency-ordered rebuild plan mapping each domain to /new-domain etc.). Write context/PROJECT_CONTEXT.md + RUNBOOK.md. migrationRoot={migrationRoot} sourceRoot={sourceRoot}")`

### Stage 6 — Reconciliation (final gate)

`Agent(subagent_type="coverage-auditor", prompt="Reconcile LEDGER.md against all extract artifacts. Every source route, component, domain entity, and token must reach a terminal status (documented|deferred|skipped — never discovered). FAIL on any unresolved discovered item or orphan. Write _reconciliation-extract.md and update LEDGER.md + PARITY.md. migrationRoot={migrationRoot} phase=extract")`

If the auditor returns **FAIL**, surface the unresolved list and stop — do not declare the extraction complete.

### Stage 7 — Final report

Summarize: artifact tree under `{migrationRoot}/`, domain count + DB choices, component reuse/build/drop counts, token mapping status, story count, and the reconciliation verdict. Point the developer to `/migrate-build-ui` for the preview build and to `RUNBOOK.md` for the backend rebuild order.

---

## Constraints

- **No spec YAML, no production code, no backend changes** in this phase.
- All artifacts live under `{source-slug}-migration/` and are committed to git for PR review.
- The ledger is the source of truth — every discovered item must reach a terminal status by Stage 6.
- Honor Gate #1 and the DB-confirmation step — never auto-decide persistence.
