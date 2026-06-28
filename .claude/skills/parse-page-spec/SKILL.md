---
name: parse-page-spec
description: "Load and validate a .specs/page-{slug}.yaml file against the page-spec JSON Schema, then produce the in-memory page summary that /webapp-feature consumes. Use this when /webapp-feature Phase 0 detects a spec path answer."
---

# Parse Page Spec — Skill

This skill replaces the inline 10-question interview phase of `/webapp-feature` when the developer provides a YAML page spec file. Both inline interview and YAML produce the **same in-memory spec summary** — downstream phases never see the difference.

---

## Inputs

- **specPath** (string) — path to the YAML file, relative to workspace root. Example: `.specs/page-payments.yaml`.

## Outputs

A normalized `PageSpec` object with this shape (return as a Markdown summary block + an internal data object the orchestrator carries through subsequent phases):

```ts
type PageSpec = {
  page: {
    route: string;                       // '/payments' | '/payments/[paymentId]'
    segment: 'public' | 'protected';
    title: string;                       // defaulted from route last segment
    layout: 'list' | 'detail' | 'form';
    permissions?: { roles: string[] };
    navigation?: {
      sidebar?: { section: string; icon: string; order: number };
    };
    routeParams: string[];               // extracted from [paramName] in route
  };
  domain: string;                        // 'payment'
  domainPascal: string;                  // 'Payment'
  contractsImport: string;               // '@old-st/contracts/{domain}'
  dataSources: Array<{ hook: string; args?: string; purpose?: string }>;
  states: {
    loading: 'skeleton-table' | 'skeleton-detail' | 'skeleton-form' | 'spinner';
    error: 'segment-error';
    empty?: { message: string; cta?: { label: string; action: string } };
  };
  components: Array<Component>;          // discriminated union by `kind`
  forms: Array<Form>;
  actions: Array<Action>;
  testIds: string[];
  figma?: { frame: string; fileKey?: string };
  // Derived analysis ------------------------------------------------
  missingHooks: string[];                // hooks referenced but not yet exported from @old-st/client-common
  missingSchemas: string[];              // form schemas referenced but not yet exported from contracts
  newPrimitives: string[];               // any primitive in components that isn't yet in @old-st/ui
  componentFiles: string[];              // file paths the orchestrator will create
};
```

---

## Procedure

### Step 1 — Read the file

```
Read(filePath="{absolute path of specPath}", startLine=1, endLine=400)
```

If the file doesn't exist, error:

```
✗ Spec file not found: {specPath}
  Run /new-page-spec to generate a template, or use the inline interview instead.
```

### Step 2 — Validate against the schema

The JSON Schema lives at `.specs/schemas/page-spec.schema.json`. Validate the parsed YAML against it. Hard-stop errors:

| Error | Message |
|---|---|
| Missing required field | `✗ Spec invalid: missing required field "{field}"` |
| Wrong enum value | `✗ Spec invalid: {field}={value} — allowed: {enum list}` |
| Pattern violation | `✗ Spec invalid: {field}="{value}" must match {pattern}` |
| `dataSources` empty | `✗ Spec invalid: dataSources MUST list at least one hook (Phase 1 only supports Mode A — consume existing endpoints)` |
| `layout=list` without a `kind=data-table` component | `✗ Spec invalid: layout=list requires at least one component with kind=data-table` |
| `layout=detail` without a `kind=detail-card` component | `✗ Spec invalid: layout=detail requires at least one component with kind=detail-card` |
| `layout=form` without any entries in `forms` | `✗ Spec invalid: layout=form requires at least one entry in forms[]` |
| `components[].kind=data-table` without `rowKey` or `columns` | `✗ Spec invalid: data-table component "{name}" requires rowKey and columns` |
| `components[].rowActions` references an unknown action | `✗ Spec invalid: component "{name}" rowActions references unknown action "{action}" — must match an entry in actions[]` |
| Status column missing `formatter` (badge present, formatter absent) | `✗ Spec invalid: column "{field}" has badge but no formatter — Golden Rule #22a requires format*Status() for status enums` |
| `forms[].fields[].type=select` without `source` | `✗ Spec invalid: form "{name}" field "{field}" type=select requires source (enum constant or hook)` |
| `actions[].opensForm` references an unknown form | `✗ Spec invalid: action "{name}" opensForm="{form}" — no such form in forms[]` |
| `empty.cta.action` references an unknown form/action | `✗ Spec invalid: empty.cta.action="{action}" — must match a form name (open-form:{name}) or an action name (action:{name})` |
| `permissions.roles[]` value not in USER_ROLES | `✗ Spec invalid: permissions.roles contains "{role}" — allowed values: see USER_ROLES in @old-st/contracts/{auth-domain}` |

For each error, surface the exact YAML line number when possible.

### Step 3 — Mode-A enforcement

Phase 1 of the page-spec system ONLY supports Mode A (consume existing API). After schema validation:

1. **Discover existing hooks.** Read `packages/client-common/src/index.ts` and grep for every `use*` and `format*Status` export.
2. **Discover existing schemas.** Read `packages/contracts/{domain}/src/index.ts` and `packages/contracts/{domain}/src/schemas.ts` for every `*Schema` export.
3. For every `dataSources[].hook`, every `forms[].submit`, every `actions[].hook` → check it exists in client-common. Collect missing entries into `missingHooks[]`.
4. For every `forms[].schema` → check it exists in the contracts package. Collect missing entries into `missingSchemas[]`.
5. **If `missingHooks` OR `missingSchemas` is non-empty:** print a hard-stop error and tell the developer to run `/new-feature` (single domain) or `/full-stack-feature` (multi-domain) FIRST. Do NOT continue to downstream phases.

```
✗ Page spec requires backend changes — cannot proceed in /webapp-feature.

Missing hooks:    useApprovePayment, useRefundPayment
Missing schemas:  refundPaymentSchema

Run /new-feature first to add these to the payment domain, then re-run /webapp-feature.
```

### Step 4 — Apply defaults

For every component / form / column / field, fill in defaults so downstream phases never see undefined:

- `page.title` → Title Case of the last static segment of `page.route` (e.g. `/payments/[paymentId]` → `Payment`).
- `page.routeParams` → array of param names extracted from `[name]` segments.
- `states.loading` → `skeleton-{layout}` (e.g. `layout=list` → `skeleton-table`).
- `states.error` → `segment-error`.
- `column.format` → `text` (or `currency` for `field=amount|total|price`, `date` for `field=date*` or `field=*At`).
- `column.sortable` → `true` for `kind=data-table`.
- `column.align` → `right` for numeric formats, `left` otherwise.
- `form.fields[].label` → Title Case of `field.name`.
- `form.fields[].optional` → defaulted to false.
- `action.intent` → `secondary` (override `destructive` if `name` includes `delete`/`cancel`/`refund`/`reject`).
- `action.confirmMessage` → `Are you sure?`.
- `figma.fileKey` → `process.env.FIGMA_FILE_KEY` if `figma.frame` is set but `fileKey` is omitted.

### Step 5 — Compute derived values

- `domainPascal` = `domain` converted from kebab-case to PascalCase (`payment-method` → `PaymentMethod`).
- `contractsImport` = `@old-st/contracts/${domain}`.
- `componentFiles` = compute the file paths the orchestrator will create:
  - Page: `apps/webapp/src/app/${segment === 'protected' ? '(protected)/' : ''}${route.replace(/^\//, '')}/page.tsx`
  - One file per `components[]` entry: `apps/webapp/src/components/${domain}/${kebab(component.name)}.tsx`
  - One file per `forms[]` entry (if `trigger=route` or `trigger=modal`): `apps/webapp/src/components/${domain}/${form.name}-form.tsx`
  - `loading.tsx` and `error.tsx` co-located with the page.
  - Detail layout also gets `apps/webapp/src/components/${domain}/${entity}-detail-skeleton.tsx`.
- `newPrimitives` = scan `components[].kind` and `forms[].fields[].type` for any primitive not currently exported from `@old-st/ui`. (Phase 1 list: `data-table`, `detail-card`, `filter-bar`, `combobox`, `daterange`, `command`, `dialog`, `alert-dialog` are the candidates that may need wrapping.)

### Step 6 — Output the Spec Summary block

Print this block in the chat so the developer can confirm before the orchestrator continues:

```markdown
## Page Spec Summary (loaded from .specs/page-payments.yaml)

- **Route:** /payments (protected)  →  apps/webapp/src/app/(protected)/payments/page.tsx
- **Layout:** list
- **Domain:** payment  →  @old-st/contracts/{domain}
- **Title:** Payments
- **Sidebar:** Finance → Payments (icon: dollar-sign, order: 3)
- **Permissions:** roles=[ADMIN, FINANCE]

- **Data sources (2):**
  | Hook | Args | Status |
  |---|---|---|
  | usePaymentsByStatus | { status, cursor } | ✓ exists |
  | usePaymentSummary | undefined | ✓ exists |

- **Components (2):**
  | Name | Kind | Notes |
  |---|---|---|
  | PaymentsTable | data-table | 4 columns, 2 row actions |
  | PaymentFilters | filter-bar | 2 filters (status select, dateRange) |

- **Forms (1):**
  | Name | Trigger | Schema | Submit hook | Status |
  |---|---|---|---|---|
  | create-payment | modal | createPaymentSchema | useCreatePayment | ✓ exists |

- **Actions (3):**
  | Name | From | Hook | Confirm | Status |
  |---|---|---|---|---|
  | approve | [PENDING] | useApprovePayment | no | ✓ exists |
  | reject | [PENDING] | useRejectPayment | yes | ✓ exists |
  | refund | [APPROVED] | useRefundPayment (opens form: refund-form) | no | ✓ exists |

- **States:** loading=skeleton-table, error=segment-error, empty.message="No payments yet"
- **TestIds (4):** payments-table, payment-row-{paymentId}, status-filter, create-payment-btn
- **Figma frame:** Webapp/Finance/PaymentsList (will query MCP if configured)

- **New files (5):**
  - apps/webapp/src/app/(protected)/payments/page.tsx
  - apps/webapp/src/app/(protected)/payments/loading.tsx
  - apps/webapp/src/app/(protected)/payments/error.tsx
  - apps/webapp/src/components/payment/payments-table.tsx
  - apps/webapp/src/components/payment/create-payment-form.tsx

- **Mode:** A (all hooks + schemas exist) ✓

Confirm to proceed, or edit the YAML and re-run.
```

### Step 7 — Hand back to the orchestrator

The orchestrator now has all the data it would have collected from inline questions. It proceeds to the same downstream phases (UI primitives if needed, domain components, forms, actions, page wire-up, tests, e2e) without asking the developer anything else.

---

## Rules

1. **Hard-stop on schema errors.** Never silently coerce or guess. Surface the exact violation and let the developer fix the YAML.
2. **Hard-stop in Mode B.** If any hook or schema is missing, the developer MUST run `/new-feature` first. Page-spec is Phase 1 — Mode A only. Do not auto-redirect or auto-invoke another orchestrator.
3. **Same output shape as inline interview.** Downstream phases of `/webapp-feature` are source-agnostic. If the inline interview ever changes, this skill must update in lockstep.
4. **Never write to the spec file.** Read-only. If validation fails, the developer edits the file and re-runs.
5. **Always print the Spec Summary block** before the orchestrator continues. Gives the developer a chance to abort.
6. **Path is relative to workspace root.** Reject absolute paths (security) and paths outside `.specs/` (convention).
7. **Status formatter check is mandatory.** Any column or detail field with `badge:` MUST also have `formatter:` — Golden Rule #22a is non-negotiable.
8. **No Figma calls in this skill.** This skill only validates the structural spec. The actual Figma MCP query happens in `/webapp-feature` Phase 2 (UI Primitives) and Phase 3 (Domain Components) when scaffolding the layout.
