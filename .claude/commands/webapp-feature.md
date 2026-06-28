---
description: "Add a new webapp page or feature — list page, detail page, form, modal, or status action. USE WHEN user says 'add a webapp page', 'add a screen to the webapp', 'add a UI for', 'create a page that', or describes any frontend-only addition that consumes existing API endpoints."
---

# Webapp Feature — Guided Workflow

You are orchestrating the addition of a new webapp page or feature. This workflow assumes the backend already exposes the necessary endpoints. If it doesn't, redirect the user to `new-feature.md` first.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **What is the user-facing capability?** (e.g. "list active payments", "create a discount", "view order timeline")
2. **What route?** (`/payments`, `/payments/[paymentId]`, `/admin/discounts`, ...)
3. **Public or protected?** (Protected pages live under `apps/webapp/src/app/(protected)/`.)
4. **Page shape:**
   - **List page** — table of records with status filter and create button?
   - **Detail page** — single record with action buttons?
   - **Form-only page** — create/edit form?
   - **Custom layout** — describe.
5. **Which API endpoints does it call?** (list them with the matching `@mma/client-common` hook names)
6. **Are there forms?**
  - If yes, provide the **exact contract schema import path + symbol** (example: `@mma/contracts/{domain}` + `create{Entity}Schema`).
  - If yes, provide the **design reference link** (Figma URL, approved design spec URL, or approved existing route reference).
7. **Are there status-driven action buttons?** (If yes, which statuses → which actions?)
8. **Does it need any new shared UI primitive** beyond what's already in `@mma/ui`?

### Auto-Detection

- If the user names a domain, auto-detect the contract package: `@mma/contracts/{domain}`.
- If hooks are missing for the named API endpoints, surface that — they'll need to be added in `client-common` first.

**Do not proceed until questions 1–7 are answered.**

Form gate (MANDATORY):
- If forms are in scope, do not proceed to implementation until BOTH of these are provided:
1. Contract schema import path + schema symbol.
2. Design reference link.
- If either is missing, stop and ask only for the missing item(s).

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

Fan out **read-only** subagents in parallel:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: webapp-new-page, webapp-form-with-validation, webapp-error-boundaries, webapp-skeleton-loading, webapp-toast-notifications, webapp-api-client-hooks, webapp-radix-primitive-wrap, write-webapp-tests, write-webapp-e2e-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=contracts+client-common, thoroughness=quick")`

Wait for all to return. Summarize what already exists (hooks, status enum, table components) and the file plan, then confirm with the user.

---

## Phase 1 — API Hooks (only if missing)

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

If the required hooks (`use{Domain}`, `useCreate{Entity}`, mutation hooks) do not yet exist in `packages/client-common/src/hooks/use-{domain}.ts`, add them now. Re-export from `packages/client-common/src/hooks/index.ts`.

If hooks already exist, skip this phase.

After this phase, run:
```
Bash(filePaths=["packages/client-common/src/hooks/use-{domain}.ts", "packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts"])
```

---

## Phase 2 — UI Primitives (only if missing)

If the new page needs a primitive that doesn't exist in `@mma/ui` (e.g. Tooltip not yet wrapped, custom Dialog variant), add it.

**Load skill:** `.claude/skills/webapp-radix-primitive-wrap/SKILL.md` (for Radix-backed primitives)
or `.claude/skills/webapp-ui-primitive/SKILL.md` (for non-Radix primitives).

Update `packages/ui/src/index.ts` barrel.

Skip this phase if existing primitives are sufficient.

---

## Phase 3 — Feature Components

**Load skill:** `.claude/skills/webapp-new-page/SKILL.md`

Create domain-scoped feature components under `apps/webapp/src/features/{domain}/`.

Preferred structure:
- `apps/webapp/src/features/{domain}/{feature-name}/...` for route-specific implementation surfaces (forms, auth flows, composed feature UIs).
- `apps/webapp/src/features/{domain}/index.ts` as a tiny barrel that re-exports feature entrypoints.

Use `apps/webapp/src/components/{domain}/` only for domain UI that is reused across multiple routes/features.

### Balanced Placement Flow (MANDATORY)

Follow this decision flow for every new UI surface:

1. **Start local to the feature**
  - Create in `apps/webapp/src/features/{domain}/{feature-name}/...`.
2. **Check current reuse before creating shared components**
  - If used by only one route/feature, keep it feature-local.
3. **Promote on proven reuse**
  - If the same UI pattern is used by **2+ routes/features** in the same domain, move it to `apps/webapp/src/components/{domain}/`.
4. **Keep imports clean during/after promotion**
  - Re-export route entrypoints from `apps/webapp/src/features/{domain}/index.ts`.
  - Pages import from the feature barrel when possible (for example `@/features/{domain}`).
5. **Avoid duplicate near-identical implementations**
  - If a second feature is about to copy a component from another feature folder, promote first, then consume the shared component.

Each feature component:
- Uses `@mma/ui` primitives (no raw HTML for interactive elements).
- Accepts data via props — does NOT call hooks directly when used inside a page that already fetches.
- Includes `data-testid` attributes per `apps/webapp-e2e/src/utils/selectors.ts` conventions.

After this phase, run:
```
Bash(filePaths=["apps/webapp/src/components/{domain}/*.tsx"])
```

If files were created under `features/`, run `Bash` on those paths instead.

---

## Phase 4 — Forms (if applicable)

**Load skill:** `.claude/skills/webapp-form-with-validation/SKILL.md`

For each form (create / edit):
- Use `react-hook-form` + `zodResolver`.
- Source schema from `@mma/contracts/{domain}` — never duplicate.
- Use `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, `<FormMessage>` from `@mma/ui`.
- Wire mutation calls to toasts via `toast.success` / `toast.error`.

---

## Phase 5 — Status Variant Mapping (if applicable)

If the page shows status badges and the domain isn't already mapped in `apps/webapp/src/lib/status-variants.ts`, add the mapping:

```ts
export function get{Domain}StatusVariant(status: string): BadgeVariant {
  switch (status) {
    case {STATUS_ENUM}.ACTIVE: return 'success';
    case {STATUS_ENUM}.PENDING: return 'warning';
    case {STATUS_ENUM}.SUSPENDED: return 'destructive';
    default: return 'default';
  }
}
```

Use enum constants from `@mma/contracts/{domain}` — never hardcode strings (Golden Rule #22).

---

## Phase 6 — Page (Orchestrator)

**Load skill:** `.claude/skills/webapp-new-page/SKILL.md` (re-read for the page section)

Create the page file at `apps/webapp/src/app/(protected)/{domain}/page.tsx` (or detail at `[entityId]/page.tsx`).

Page rules:
- `'use client'` (React Query hooks).
- Wires hooks → state → child components.
- No table/form markup inline — that lives in `features/{domain}/...` (or `components/{domain}/` only when broadly reusable).
- No direct API calls — only via hooks from `@mma/client-common`.
- Import feature entrypoints through the domain barrel when present (example: `@/features/{domain}`).

---

## Phase 7 — Error & Loading Boundaries

**Load skill:** `.claude/skills/webapp-error-boundaries/SKILL.md`

For the new route segment, add:
- `error.tsx` (always)
- `loading.tsx` (when the page does its own data fetching)
- `not-found.tsx` (only for detail pages where the record may not exist)

For loading skeletons, see:
- **Load skill:** `.claude/skills/webapp-skeleton-loading/SKILL.md`

---

## Phase 8 — Sidebar / Navigation

If this is a new top-level domain section, add a link to `apps/webapp/src/components/layout/sidebar.tsx`. Skip if this is a detail or sub-page.

---

## Phase 9 — Tests

**Load skill:** `.claude/skills/write-webapp-tests/SKILL.md`

Add unit tests for:
- Domain components with conditional rendering (action buttons by status, status badge logic, empty state).
- Forms (valid submit, invalid submit shows `<FormMessage>`, mutation error shows toast).
- Status-variant pure function.

Run:
```
pnpm nx test webapp
```

---

## Phase 10 — E2E Tests (when feature is user-critical)

**Load skill:** `.claude/skills/write-webapp-e2e-tests/SKILL.md`

Add a Playwright spec at `apps/webapp-e2e/src/specs/{domain}/{feature}.spec.ts` covering:
- Page loads with seeded data.
- Create flow (form submit → toast → row appears).
- Status action flow (button click → optimistic UI → confirmed).

Run:
```
pnpm nx e2e webapp-e2e
```

---

## Final Verification

Run in order:
1. `pnpm tsx scripts/lint-standards.ts` — no new violations.
2. `pnpm nx test client-common ui webapp` — all pass.
3. `pnpm nx build webapp` — Next.js build clean.
4. `pnpm nx e2e webapp-e2e` — flows pass.
5. Pre-merge subagent fan-out (read-only, in parallel):
   - `Agent(subagent_type="dependency-auditor", prompt="scope=apps/webapp/**,packages/client-common/**,packages/ui/**,packages/contracts/{domain}/**")`
   - `Agent(subagent_type="golden-rule-validator", prompt="scope=webapp:{domain}, ruleSet=frontend")`
   - If contracts changed: `Agent(subagent_type="contract-diff-analyzer", prompt="domain={domain}, proposedChange={summary}")`
   - `Agent(subagent_type="e2e-impact-predictor", prompt="changedFiles={comma-separated list of files touched in this workflow}")`

Surface any failures to the user before claiming done.
