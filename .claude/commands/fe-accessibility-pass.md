---
description: Run an accessibility audit pass over the webapp, identify violations, and fix the critical/serious ones.
---

# Workflow: webapp accessibility pass

A focused, multi-phase workflow for finding and fixing a11y violations in the webapp. Use when shipping a release, when a new top-level page lands, or when an audit is requested.

This workflow REQUIRES the `fe-accessibility-audit` skill — load it before Phase 1.

## Phase 0 — Interview

Ask the user, before doing anything else:

1. **Scope**: which pages? (full app / specific routes / a single new page just shipped)
2. **Severity bar**: fix only `critical` + `serious`, or also `moderate` / `minor`?
3. **Mobile too?** — separate audit if yes (different tooling)
4. **Visual confirmation**: should we add screenshots of any fixes to the PR?

If the user says "all of it", default to: **all pages in `PAGES_TO_SCAN`, fix all `critical`/`serious`, defer the rest with a follow-up issue, web only.**

## Phase 1 — Run the scan

1. Load the `fe-accessibility-audit` skill.
2. Confirm `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts` covers all pages from Phase 0. If a page is missing, add it to `PAGES_TO_SCAN`.
3. Run the suite:
   ```bash
   pnpm nx e2e webapp-e2e -- --grep "@a11y"
   ```
4. Capture the failures list. Group by `id` (rule), then by impact.

## Phase 2 — Plan the fixes

For each `critical` / `serious` violation, decide which layer fixes it:

| Where | When |
|---|---|
| `packages/ui/src/components/*` | Primitive is wrong (missing `aria-label`, focus styles, contrast). All consumers benefit. |
| `apps/webapp/src/components/{domain}/*` | Domain component composes primitives incorrectly (missing `<Label>`, wrong heading order). |
| `apps/webapp/src/app/**/*` | Route-level structure (missing landmark, duplicate `<main>`). |
| `packages/ui/src/lib/tokens.ts` + `globals.css` | Color contrast — adjust the token, not the consumer. |

Present the plan to the user as a numbered list before editing.

## Phase 3 — Fix in order

Fix in dependency order — primitives first, then domain components, then routes. After each layer:

1. `pnpm nx test webapp` (and `ui` if a primitive changed)
2. Re-run the a11y suite — confirm violation count is decreasing

If a fix requires a new ARIA pattern not currently in `@old-st/ui`, see the [webapp-radix-primitive-wrap](../../skills/webapp-radix-primitive-wrap/SKILL.md) skill before hand-rolling.

## Phase 4 — Verify

Final pass:

```bash
pnpm nx test webapp
pnpm nx build webapp
pnpm nx e2e webapp-e2e -- --grep "@a11y"
```

All three must be green before declaring done.

## Phase 5 — Document deferred work

If `moderate` / `minor` violations remain, open a follow-up issue listing them with rule IDs, page paths, and `helpUrl` from the axe output. Link the issue from the PR.

## Out of scope

- Native (mobile) a11y — separate workflow
- Lighthouse Performance / Best Practices scoring — see `fe-performance-bundle-analysis`
- Manual screen-reader testing — flag for QA, don't attempt in this workflow
