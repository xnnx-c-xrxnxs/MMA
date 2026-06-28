---
description: "Generate a fully-commented domain-spec YAML template at .specs/domain-{name}.yaml. USE WHEN user says 'generate a domain spec', 'create a domain template', '/new-domain-spec', or wants a starter YAML file to fill in before running /new-domain. The template includes inline comments for every field option and a worked example."
---

# Domain Spec Template — Guided Workflow

You are scaffolding a YAML spec file that the developer will edit and then feed to `/new-domain`, `/new-domain-dynamo`, or `/quick-crud-domain`.

This prompt does NOT scaffold any code. Its only job is to write the template file and tell the developer what to do next.

---

## Phase 0 — One Question

Ask via `vscode_askQuestions`:

1. **Domain name?** — lowercase kebab-case (e.g. `invoice`, `payment-method`, `shipping-rate`).

That's it. Defaults for everything else are encoded in the template comments.

---

## Phase 1 — Verify Folder Exists

```
Glob(path=".specs")
```

If the folder doesn't exist, create the directory by writing a placeholder `README.md` reference (the [`.specs/README.md`](.specs/README.md) should already exist from initial template setup — if not, surface that as an error and stop).

---

## Phase 2 — Detect Conflicts

If `.specs/domain-{name}.yaml` already exists, ask:

```
A spec file for "{name}" already exists at .specs/domain-{name}.yaml.
Choose:
  A. Overwrite (lose current contents)
  B. Open the existing file and stop
  C. Cancel
```

Default to B if the answer is unclear.

---

## Phase 3 — Write the Template

Create the file at `.specs/domain-{name}.yaml` with EXACTLY this content (substitute `{name}` and `{Name}` — `{Name}` is `{name}` in PascalCase, e.g. `payment-method` → `PaymentMethod`):

```yaml
# yaml-language-server: $schema=../schemas/domain-spec.schema.json
#
# Domain spec for: {name}
# Edit this file, then run:   /new-domain   (or /new-domain-dynamo, /quick-crud-domain)
# When prompted for a spec, paste the path:   .specs/domain-{name}.yaml
#
# Schema reference: .specs/schemas/domain-spec.schema.json
# Worked examples:
#   .specs/example-invoice.yaml       (Prisma + Postgres)
#   .specs/example-subscription.yaml  (DynamoDB OneTable)

domain: {name}

# Persistence: dynamodb (OneTable + cursor pagination) OR prisma (Postgres + offset + migrations).
# DynamoDB → fast for key-value, single-table, serverless-first.
# Prisma   → relational data, joins, transactions, aggregates.
persistence: dynamodb

entity:
  name: {Name}
  description: "TODO: one-line business description of what this entity represents"

  fields:
    # ─── Primary key (always include) ─────────────────────────────────────
    - name: id
      type: ulid
      pk: true

    # ─── Example field types — uncomment and edit ─────────────────────────
    # - { name: name,         type: string, min: 1, max: 200 }
    # - { name: email,        type: email,  unique: true, gsi: GSI1 }      # DynamoDB unique → dedicated GSI
    # - { name: customerId,   type: ulid,   gsi: GSI2 }                    # FK-style lookup
    # - { name: amount,       type: number, min: 0 }
    # - { name: quantity,     type: integer, min: 1 }
    # - { name: isActive,     type: boolean, default: true }
    # - { name: dateOfBirth,  type: date,   optional: true }
    # - { name: createdAt,    type: datetime }                             # never add — managed by entity
    # - { name: metadata,     type: json,   optional: true }
    # - { name: website,      type: url,    optional: true }

    # ─── Status enum (drives state transitions; remove if entity has none) ─
    - name: status
      type: enum
      values: [DRAFT, ACTIVE, ARCHIVED]   # SCREAMING_SNAKE_CASE, edit to your states
      default: DRAFT

    # ─── Audit fields (always include — managed automatically) ────────────
    - { name: dateCreated, type: datetime }
    - { name: updatedAt,   type: datetime }

# ─── Business rules — drives the domain-business-rules skill ────────────
# Free-form sentences. Be specific about state transitions and invariants.
businessRules:
  # - "DRAFT → ACTIVE only"
  # - "ACTIVE → ARCHIVED only"
  # - "ARCHIVED is terminal — no transitions out"
  # - "amount must be > 0"

# ─── Domain events — triggers sqs-event-publisher skill if non-empty ────
# SCREAMING_SNAKE_CASE event type names.
events: []
  # - {NAME_UPPER}_CREATED
  # - {NAME_UPPER}_ARCHIVED

# ─── Additional access patterns beyond primary key ──────────────────────
# DynamoDB → defines GSIs (referenced via field.gsi above).
# Prisma   → defines composite indexes / unique constraints.
indexes: []
  # - { name: GSI1, fields: [email],            description: "lookup by email" }
  # - { name: GSI2, fields: [customerId, status], description: "list by customer + status" }

# ─── Use cases — OPTIONAL, omit to let orchestrator infer defaults ──────
# Default inferred set: create, get, list, update, delete + one transition per state.
useCases: []
  # - { name: create{Name},      type: create }
  # - { name: get{Name},         type: read }
  # - { name: list{Name}sByStatus, type: list }
  # - { name: archive{Name},     type: transition, description: "ACTIVE → ARCHIVED" }
```

> Replace `{NAME_UPPER}` with the entity name in SCREAMING_SNAKE_CASE (e.g. `Invoice` → `INVOICE`).

---

## Phase 4 — Final Message

Tell the developer:

```
✓ Created .specs/domain-{name}.yaml

Next steps:
  1. Open the file. The VS Code YAML extension provides autocomplete + validation
     via the JSON Schema header.
  2. Edit the fields, businessRules, events, and indexes sections.
  3. When ready, run:
       /new-domain          (full interview, will detect your spec)
       /new-domain-dynamo   (skip persistence question)
       /quick-crud-domain   (no business rules, fastest path)

  4. When the orchestrator asks for a spec, answer:
       .specs/domain-{name}.yaml

The spec file is gitignored by default. To commit it (recommended for visibility
in PRs), add an exception in .gitignore:
  !.specs/domain-{name}.yaml
```

Stop. Do not invoke `/new-domain` automatically — the developer must edit the file first.

---

## Rules

1. **One file per run.** Never overwrite without explicit confirmation in Phase 2.
2. **No code scaffolding.** This prompt only writes one YAML file.
3. **Always include the schema header.** The `# yaml-language-server: $schema=` line is what gives the developer autocomplete in VS Code.
4. **Defaults are conservative.** DynamoDB is the default persistence (cheaper local infra, simpler). Developer changes to `prisma` if they need joins.
