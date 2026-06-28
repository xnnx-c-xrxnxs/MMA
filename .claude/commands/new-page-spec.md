---
description: "Generate a fully-commented page-spec YAML template at .specs/page-{slug}.yaml. USE WHEN user says 'generate a page spec', 'create a page template', '/new-page-spec', or wants a starter YAML file to fill in before running /webapp-feature on a non-trivial page (list / detail / form). The template includes inline comments for every field option and references a worked example."
---

# Page Spec Template — Guided Workflow

You are scaffolding a YAML spec file that the developer will edit and then feed to `/webapp-feature`.

This prompt does NOT scaffold any code. Its only job is to write the template file and tell the developer what to do next.

**Phase 1 scope:** list, detail, and form pages that consume EXISTING backend endpoints (Mode A). For dashboards, wizards, or pages that need new backend work, use the chat-box interview or `/full-stack-feature` instead.

---

## Phase 0 — Two Questions

Ask via `vscode_askQuestions`:

1. **Route?** — the Next.js path. Examples: `/payments`, `/payments/[paymentId]`, `/admin/discounts`. Dynamic segments use `[paramName]`.
2. **Domain?** — lowercase kebab-case. Examples: `payment`, `discount`, `shipping-rate`. Determines the contract import (`@old-st/contracts/{domain}`) and the `components/{domain}/` folder.

Derive the file slug from the route:

```
'/payments'                    → 'payments'
'/payments/[paymentId]'        → 'payments-detail'
'/admin/discounts'             → 'admin-discounts'
'/admin/discounts/[id]/edit'   → 'admin-discounts-edit'
```

(Strip `[ ]`, replace `/` with `-`, lowercase, then append `-detail` / `-edit` / `-create` if the last segment is dynamic or a known verb.)

That's it. Defaults for everything else are encoded in the template comments.

---

## Phase 1 — Verify Folder Exists

```
Glob(path=".specs")
```

If the folder doesn't exist, surface that as an error and stop — `.specs/README.md` should exist from initial template setup.

---

## Phase 2 — Detect Conflicts

If `.specs/page-{slug}.yaml` already exists, ask:

```
A spec file for "{slug}" already exists at .specs/page-{slug}.yaml.
Choose:
  A. Overwrite (lose current contents)
  B. Open the existing file and stop
  C. Cancel
```

Default to B if the answer is unclear.

---

## Phase 3 — Write the Template

Create the file at `.specs/page-{slug}.yaml`. Substitute `{route}`, `{domain}`, `{Domain}` (PascalCase), and `{Entity}` (PascalCase singular of the domain — usually the same as `{Domain}`).

```yaml
# yaml-language-server: $schema=../schemas/page-spec.schema.json
#
# Page spec for: {route}
# Edit this file, then run:   /webapp-feature
# When prompted, paste the path:   .specs/page-{slug}.yaml
#
# Schema reference: .specs/schemas/page-spec.schema.json
# Worked example:   .specs/example-page-payments.yaml
#
# Phase 1 scope: list / detail / form pages, Mode A only (all hooks must already exist).
# For dashboards, wizards, or new backend endpoints — use /webapp-feature inline interview
# or /full-stack-feature instead.

page:
  route: {route}
  segment: protected           # public | protected
  title: "TODO Page Title"
  layout: list                  # list | detail | form
  permissions:
    roles: []                   # e.g. [ADMIN, FINANCE] — see USER_ROLES in @old-st/contracts/{auth-domain}
  navigation:
    sidebar:
      section: "TODO Section"   # Sidebar header text — Operations, Finance, Admin, ...
      icon: "circle"            # lucide-react icon name (kebab-case)
      order: 99                 # Lower = higher in the section

domain: {domain}

# ─── React Query hooks (REQUIRED — at least one) ─────────────────────────
# All hooks MUST already exist in @old-st/client-common. If anything is missing,
# /webapp-feature will hard-stop and tell you to run /new-feature first.
dataSources:
  - hook: use{Domain}sByStatus
    args: "{ status, cursor }"
    purpose: "Paginated list driven by the status filter"
  # - hook: use{Domain}Summary
  #   args: "undefined"

# ─── Loading / error / empty states ──────────────────────────────────────
states:
  loading: skeleton-table       # skeleton-table | skeleton-detail | skeleton-form | spinner
  error: segment-error
  empty:
    message: "No {domain}s yet — create your first one."
    cta:
      label: "New {Entity}"
      action: "open-form:create-{domain}"

# ─── Domain components rendered on the page ──────────────────────────────
components:
  - name: {Domain}Table
    kind: data-table
    rowKey: {domain}Id
    rowLink: "/{domain}s/{{{domain}Id}}"   # Use {fieldName} to interpolate from row data
    columns:
      - { field: {domain}Id, label: ID, format: truncate }
      - { field: amount,     label: Amount, format: currency, align: right }
      - { field: status,     label: Status, badge: {domain}StatusVariant, formatter: format{Domain}Status }
      - { field: dateCreated, label: Created, format: datetime }
    rowActions: []              # e.g. [refund, cancel] — must match action names below

  # - name: {Domain}Filters
  #   kind: filter-bar
  #   filters:
  #     - { name: status, type: select, source: {Domain}StatusEnum }
  #     - { name: search, type: search, label: "Search by ID" }

# ─── Forms (if any) ──────────────────────────────────────────────────────
# Schemas MUST come from @old-st/contracts/{domain} — never duplicate.
forms: []
  # - name: create-{domain}
  #   schema: create{Domain}Schema
  #   submit: useCreate{Domain}
  #   trigger: modal             # button | modal | route
  #   title: "Create {Entity}"
  #   fields:
  #     - { name: amount, type: number, min: 0 }
  #     - { name: notes,  type: textarea, optional: true }
  #   onSuccess:
  #     toast: "{Entity} created."
  #     closeModal: true

# ─── Status-driven action buttons ────────────────────────────────────────
actions: []
  # - name: approve
  #   label: Approve
  #   from: [PENDING]
  #   hook: useApprove{Domain}
  #   intent: primary
  # - name: refund
  #   label: Refund
  #   from: [APPROVED]
  #   hook: useRefund{Domain}
  #   confirm: true
  #   confirmMessage: "Refund this {domain}? This cannot be undone."
  #   intent: destructive
  #   opensForm: refund-{domain}    # optional — open a form instead of calling hook directly

# ─── data-testid attributes (Playwright + RTL) ───────────────────────────
testIds:
  - {domain}s-table
  - {domain}-row-{{{domain}Id}}
  - status-filter
  - create-{domain}-btn

# ─── OPTIONAL Figma reference ────────────────────────────────────────────
# If your design lives in Figma, /webapp-feature will query the Figma Dev MCP
# server (when configured) for layout / spacing / colors. Page STRUCTURE stays
# in this YAML — Figma owns appearance only.
# figma:
#   frame: "Webapp/{Section}/{ViewName}"
```

---

## Phase 4 — Final Message

Tell the developer:

```
✓ Created .specs/page-{slug}.yaml

Next steps:
  1. Open the file. The VS Code YAML extension provides autocomplete + validation
     via the JSON Schema header.
  2. Edit dataSources, components, forms, and actions.
  3. When ready, run:
       /webapp-feature
  4. When the orchestrator asks for a spec path, answer:
       .specs/page-{slug}.yaml

Tips:
  - All hooks referenced in dataSources / forms.submit / actions.hook must
    already exist in @old-st/client-common. Run /new-feature FIRST if not.
  - Status columns MUST set both `badge:` and `formatter:` (Golden Rule #22a).
  - The spec file is gitignored by default. To commit it (recommended for
    visibility in PRs), add an exception in .gitignore:
      !.specs/page-{slug}.yaml
```

Stop. Do not invoke `/webapp-feature` automatically — the developer must edit the file first.

---

## Rules

1. **One file per run.** Never overwrite without explicit confirmation in Phase 2.
2. **No code scaffolding.** This prompt only writes one YAML file.
3. **Always include the schema header.** The `# yaml-language-server: $schema=` line is what gives the developer autocomplete in VS Code.
4. **Defaults are conservative.** `segment: protected` and `layout: list` are the most common choices. Developer overrides as needed.
5. **Phase 1 only.** This template does NOT include dashboard / wizard layouts or mobile parity blocks. Those will be added in a later phase based on actual usage.
