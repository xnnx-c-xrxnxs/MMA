---
name: parse-domain-spec
description: "Load and validate a .specs/domain-{name}.yaml file against the JSON Schema, then produce the in-memory spec summary that /new-domain, /new-domain-dynamo, and /quick-crud-domain consume. Use this when an orchestrator's Phase 0 detects a spec path answer."
---

# Parse Domain Spec — Skill

This skill replaces the inline interview phase of a domain orchestrator when the developer provides a YAML spec file. Both inline interview and YAML produce the **same in-memory spec summary** — downstream phases never see the difference.

---

## Inputs

- **specPath** (string) — path to the YAML file, relative to workspace root. Example: `.specs/domain-invoice.yaml`.

## Outputs

A normalized spec object with this shape (return as a Markdown summary block + an internal data object the orchestrator carries through subsequent phases):

```ts
type DomainSpec = {
  domain: string;                        // 'invoice'
  domainPascal: string;                  // 'Invoice'
  domainUpper: string;                   // 'INVOICE'
  persistence: 'dynamodb' | 'prisma';
  service: { type: 'api' | 'event-handler'; name: string };
  entity: {
    name: string;                        // 'Invoice'
    description?: string;
    fields: Array<{
      name: string;
      type: string;                      // 'ulid' | 'string' | 'enum' | ...
      values?: string[];                 // enum values
      labels?: Record<string, string>;   // OPTIONAL display labels for enum values (FE format*Status helper)
      default?: unknown;
      optional: boolean;                 // defaulted false
      pk: boolean;                       // defaulted false
      unique: boolean;
      gsi?: string;
      index: boolean;
      min?: number;
      max?: number;
      description?: string;
    }>;
  };
  businessRules: string[];
  events: string[];
  indexes: Array<{ name: string; fields: string[]; unique: boolean; description?: string }>;
  useCases: Array<{ name: string; type?: string; description?: string }>;
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
  Run /new-domain-spec to generate a template, or use the inline interview instead.
```

### Step 2 — Validate against the schema

The JSON Schema lives at `.specs/schemas/domain-spec.schema.json`. Validate the parsed YAML against it. Hard-stop errors:

| Error | Message |
|---|---|
| Missing required field | `✗ Spec invalid: missing required field "{field}"` |
| Wrong enum value | `✗ Spec invalid: {field}={value} — allowed: {enum list}` |
| Pattern violation | `✗ Spec invalid: {field}="{value}" must match {pattern}` (e.g. domain not kebab-case) |
| Two fields with `pk: true` | `✗ Spec invalid: only one field may have pk:true (found {n})` |
| Zero fields with `pk: true` | `✗ Spec invalid: exactly one field must have pk:true` |
| `type: enum` without `values` | `✗ Spec invalid: field "{name}" is type:enum but has no values` |
| `default` not in `values` for enum | `✗ Spec invalid: field "{name}" default="{default}" is not in values [{list}]` |
| `labels` key not in `values` for enum | `✗ Spec invalid: field "{name}" label key "{key}" is not in values [{list}]` |
| Index references a non-existent field | `✗ Spec invalid: index "{name}" references unknown field "{field}"` |

For each error, surface the exact YAML line number when possible.

### Step 3 — Persistence-specific validation

**DynamoDB:**
- Reject any field with `index: true` (Prisma-only).
- For each field with `gsi: GSIn`, ensure that GSI is also declared in the top-level `indexes` block (or auto-add it with PK = the field name).
- Warn if no field has `gsi` AND `unique: true` together — uniqueness on DynamoDB requires a GSI.

**Prisma:**
- Reject any field with `gsi` (DynamoDB-only).
- `index: true` is only permitted on non-PK fields.
- Warn if `events` is non-empty but no SQS publisher infrastructure exists yet (orchestrator will scaffold it).

### Step 4 — Apply defaults

For every field, fill in defaults so downstream phases never see undefined:
- `optional: false`
- `pk: false`
- `unique: false`
- `index: false`

For top-level keys:
- `service.type: 'api'`, `service.name: '{domain}-api-service'` if `service` is omitted.
- `businessRules: []`, `events: []`, `indexes: []`, `useCases: []` if omitted.

### Step 5 — Compute derived values

- `domainPascal` = `domain` converted from kebab-case to PascalCase (`payment-method` → `PaymentMethod`).
- `domainUpper` = `entity.name` converted to SCREAMING_SNAKE_CASE (`PaymentMethod` → `PAYMENT_METHOD`).
- If `useCases` is empty, infer the default set:
  - `create{EntityName}` (type: create)
  - `get{EntityName}` (type: read)
  - `list{EntityName}s` (type: list)
  - `update{EntityName}` (type: update)
  - `delete{EntityName}` (type: delete)
  - One transition per pair of adjacent values in any enum field whose name is `status` (e.g. `DRAFT → ACTIVE` becomes `activate{EntityName}`).

### Step 6 — Output the Spec Summary block

Print this block in the chat so the developer can confirm before the orchestrator continues:

```markdown
## Spec Summary (loaded from .specs/domain-invoice.yaml)

- **Domain:** invoice → packages/invoice-domain
- **Persistence:** dynamodb
- **Entity:** Invoice (TODO description)
- **Fields (8):**
  | Name | Type | Notes |
  |---|---|---|
  | id | ulid | PK |
  | customerId | ulid | GSI1 |
  | status | enum [DRAFT, SENT, PAID, VOID] | default DRAFT |
  | total | number | min: 0 |
  | dueDate | date | optional |
  | dateCreated | datetime | |
  | updatedAt | datetime | |
- **Business rules:** 3 declared
- **Events:** INVOICE_CREATED, INVOICE_PAID
- **Indexes:** 1 (GSI1: customerId)
- **Use cases:** 6 (5 inferred + 1 transition)

Confirm to proceed, or edit the YAML and re-run.
```

### Step 7 — Hand back to the orchestrator

The orchestrator now has all the data it would have collected from inline questions. It proceeds to the same downstream phases (entity scaffold, contracts, repository, etc.) without asking the developer anything else.

---

## Rules

1. **Hard-stop on schema errors.** Never silently coerce or guess. Surface the exact violation and let the developer fix the YAML.
2. **Same output shape as inline interview.** Downstream phases are persistence-agnostic and source-agnostic. If the inline interview ever changes, this skill must update in lockstep.
3. **Never write to the spec file.** Read-only. If validation fails, the developer edits the file and re-runs.
4. **Always print the Spec Summary block** before the orchestrator continues. Gives the developer a chance to abort.
5. **Path is relative to workspace root.** Reject absolute paths (security) and paths outside `.specs/` (convention).
