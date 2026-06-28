# .specs/

This folder holds **domain spec YAML files** (`domain-{name}.yaml`) that drive the `/new-domain`, `/new-domain-dynamo`, and `/quick-crud-domain` orchestrators, plus **page spec YAML files** (`page-{slug}.yaml`) consumed by `/webapp-feature` and `/migrate-page`.

Instead of typing structured data (field names, types, enums, indexes) into the chat box, you write it once in a YAML file with full editor autocomplete and validation, then point the orchestrator at the file.

## Where specs come from

| Source                     | How                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-authored              | Run `/new-domain-spec` for a commented domain template, then edit.                                                                                                    |
| Generated from a migration | Run `/migrate-to-specs` after `/migrate-extract` — it translates the analysis cards under `{migrationRoot}/` into `domain-*.yaml` + `page-*.yaml` here automatically. |

## Why YAML instead of chat?

| Chat input                              | YAML spec                                  |
| --------------------------------------- | ------------------------------------------ |
| No autocomplete                         | Full IntelliSense (via JSON Schema)        |
| Easy to mistype                         | Schema validation in editor                |
| Lost in transcript                      | Reviewable in PR                           |
| Hard to revise                          | Edit + re-run                              |
| Re-doing scaffold = retyping everything | Re-doing scaffold = same YAML, same output |

## Quick start

```
1. Run /new-domain-spec → generates a commented template at
   .specs/domain-{name}.yaml
2. Edit the file. The header `# yaml-language-server: $schema=...` line
   gives VS Code autocomplete for every field.
3. Run /new-domain (or /new-domain-dynamo, /quick-crud-domain).
4. When asked for a spec, paste the file path.
```

## Worked examples

Two full examples are committed for reference — one per persistence strategy:

| File                                                     | Persistence       | Highlights                                                                                     |
| -------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| [`example-invoice.yaml`](example-invoice.yaml)           | Prisma + Postgres | Composite indexes, `unique: true`, relational FKs, offset pagination                           |
| [`example-subscription.yaml`](example-subscription.yaml) | DynamoDB OneTable | GSI access patterns, unique-via-GSI, cursor-paginated `listByX` use cases, intra-domain events |

Copy whichever matches your domain's persistence.

## Schema reference

The full JSON Schema is at [`.specs/schemas/domain-spec.schema.json`](schemas/domain-spec.schema.json). Open any spec file in VS Code with the YAML extension installed and you'll get:

- Field name autocomplete
- Type-specific value hints (e.g. `type:` → dropdown of `ulid | string | number | enum | ...`)
- Inline error markers for invalid combinations (two PKs, enum without values, etc.)
- Hover docs for every field

## Recommended VS Code extensions

- [`redhat.vscode-yaml`](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) — YAML language support + JSON Schema integration. The `# yaml-language-server: $schema=...` header in each spec file activates it automatically.

## Should spec files be committed?

**By default, this folder is gitignored** except for the README and the worked example.

Two options:

| Option                        | When                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep gitignored** (default) | Spec files are scratch — useful for the dev who scaffolds the domain, deleted after. Domain code lives in `packages/` permanently.                                                                                    |
| **Commit specs**              | You want the spec reviewed in the PR alongside the generated code, or you want re-runnable scaffold for future schema-driven changes. Add an exception per file in `.gitignore`: `!.specs/domain-{name}.yaml` |

Either is fine — pick what matches your team's review culture.

## Inline interview is still supported

If you only have 2–3 fields, typing into chat is still faster. The orchestrators offer three options in Phase 0:

- **A.** I have a spec file → paste path
- **B.** Generate a template, I'll edit, then resume → runs `/new-domain-spec`
- **C.** Interview me inline → original flow

Pick whichever fits the size of the change.
