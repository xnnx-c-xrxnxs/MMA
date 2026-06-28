# Coding Standards — Old St Labs Clean Architecture Template

> **Version:** 1.1.0  
> **Last Updated:** June 5, 2026 — Added E12 (no-legacy-ai-config-references) check to keep the Copilot → Claude Code migration (ADR-008) at 100%. Previously: E10 (barrel-export-completeness), E11 (service-registry-env-sync); added skill reference to Extending Standards section.  
> **Purpose:** Single reference for all enforced coding standards. Each standard lists its enforcement method and how to override it.

---

## How Standards Are Enforced

| Layer | Mechanism | Blocks PR? | Per-project configurable? |
|---|---|---|---|
| **ESLint Plugin** (`@old-st/eslint-plugin`) | Runs during `nx lint` and CI | **Yes** | Override rules in project `eslint.config.mjs` |
| **Code Review** (`docs/code-review-guidelines.md`) | Judgment-based review (human or `/code-review`) | No (advisory) | Edit file per project |
| **CI Structural Checks** (`scripts/lint-standards.ts`) | Runs in CI fast-check | **Yes** | Toggle in `coding-standards.config.ts` |
| **Spectral API Lint** (`.spectral.yml`) | Runs in CI after build | **Yes** | Extend/override in project `.spectral.yml` |
| **Nx Module Boundaries** (`eslint.config.mjs`) | Runs during `nx lint` | **Yes** | Modify `depConstraints` in ESLint config |
| **Coverage Thresholds** (`jest.config.ts`) | Runs during `nx test --coverage` | **Yes** | Adjust per-project `coverageThreshold` |

---

## Category A — Architecture & Clean Architecture

### A1: Controllers Never Call Use Cases Directly
- **Rule:** Controllers → Application Services → Use Cases. Never skip the Application Service layer.
- **Enforced by:** ESLint `@old-st/enforce-service-boundary` (error)
- **Override:** `'@old-st/enforce-service-boundary': 'off'` in project ESLint config

### A2: Application Services Always Present
- **Rule:** Even for simple pass-through operations, an Application Service must exist between the controller and use case.
- **Enforced by:** Code review (advisory)

### A3: Use Cases Return Domain Entities
- **Rule:** Use cases return domain entities, not DTOs. The Application Service transforms to DTOs.
- **Enforced by:** Code review (advisory)

### A4: Application Services Transform via Zod schema.parse()
- **Rule:** Application Services transform entities to DTOs using `@old-st/contracts` Zod schemas.
- **Enforced by:** Code review (advisory)

### A5: Domain Layer Has Zero Framework Dependencies
- **Rule:** Files in `domain/entities/`, `domain/constants/`, `domain/exceptions/` must not import `@nestjs/*`, `zod`, `express`, `@old-st/contracts/*`.
- **Enforced by:** ESLint `@old-st/no-domain-framework-imports` (error)
- **Override:** `'@old-st/no-domain-framework-imports': ['error', { bannedPackages: [...] }]`

### A6: Infrastructure Has No Business Logic
- **Rule:** Repositories implement interfaces. All business decisions live in entities and use cases.
- **Enforced by:** Code review (advisory)

### A7: Zod Validation in Presentation Only
- **Rule:** Zod lives in presentation layer (pipes, filters) and contracts packages only.
- **Enforced by:** ESLint `@old-st/no-domain-framework-imports` (bans `zod` in domain layer)

### A8: Domain Constants Are Single Source of Truth
- **Rule:** Never hardcode `'PENDING'`, `'ACTIVE'`, `'USER'`, etc. Use enum constants.
- **Enforced by:** ESLint `@old-st/no-hardcoded-status-strings` (error)
- **Override:** `'@old-st/no-hardcoded-status-strings': ['error', { allowed: ['CUSTOM'] }]`

### A9: DomainExceptionFilter Required
- **Rule:** Every HTTP API service must have a `domain-exception.filter.ts`.
- **Enforced by:** CI `lint-standards.ts` → `domain-exception-filter-exists` check

### A10: Never Trust Client userId
- **Rule:** Derive userId from auth context, never from request body.
- **Enforced by:** Code review (advisory)

### A11: No Bare Contracts Import
- **Rule:** Always `@old-st/contracts/{domain}`, never bare `@old-st/contracts`.
- **Enforced by:** ESLint `@old-st/no-bare-contracts-import` (error)

### A12: Entity Timestamps — dateCreated + updatedAt Only
- **Rule:** Never add `createdAt` field to entities.
- **Enforced by:** CI `lint-standards.ts` → `no-createdAt-in-entities` check

### A13: No toObject() on Entities
- **Rule:** Serialization via Application Service → Zod pipeline. No `toObject()` methods.
- **Enforced by:** CI `lint-standards.ts` → `no-toObject-in-entities` check

---

## Category B — Import & Dependency Rules

### B1: Domain-Scoped Contract Imports Only
- **Enforced by:** ESLint `@old-st/no-bare-contracts-import` (same as A11)

### B2: Cross-Domain Consumers Import Contracts Only
- **Rule:** Event consumers import from `@old-st/contracts/{publishing-domain}`, never `@old-st/{domain}-domain`.
- **Enforced by:** Nx module boundaries (`@nx/enforce-module-boundaries`)

### B3: @prisma/client Banned Outside Infrastructure
- **Enforced by:** ESLint `@old-st/no-prisma-client-in-domain` (error)

### B4: Use Cases Have Zero Contract Imports
- **Rule:** Use case inputs are primitive types only.
- **Enforced by:** ESLint `@old-st/no-contracts-in-use-cases` (error)

### B5: ACL — Consuming Domain Never Imports Upstream Domain
- **Enforced by:** Nx module boundaries

### B6: No Framework Imports in Domain Entities
- **Enforced by:** ESLint `@old-st/no-domain-framework-imports` (same as A5)

### B7: Prisma Repos Use Generated Client Path
- **Rule:** Import from `../generated/client`, not `@prisma/client`.
- **Enforced by:** ESLint `@old-st/no-prisma-client-in-domain` (covers infrastructure too)

### B8: STAGE=local for Local Detection
- **Rule:** Never `NODE_ENV === 'development'`.
- **Enforced by:** ESLint `@old-st/no-node-env-development` (error) + CI `lint-standards.ts`

---

## Category C — REST API Design

### C1: Plural Nouns for Collections
- **Enforced by:** Spectral `paths-no-singular-resources` (warn)

### C2: Kebab-Case Lowercase Paths
- **Enforced by:** Spectral `paths-kebab-case` (error)

### C3: No Verbs in Resource Names
- **Enforced by:** Spectral `paths-no-verbs` (warn)

### C4: Correct HTTP Status Codes
- **Rule:** 201 for POST create, 204 for DELETE, etc.
- **Enforced by:** Spectral `response-post-201` (info)

### C5–C6: State Transitions / Filter Placement
- **Enforced by:** Code review (advisory)

### C7: Standardized Error Shape
- **Rule:** `{ statusCode, error, message }` — no `timestamp`.
- **Enforced by:** Spectral `error-no-timestamp` (error) + CI `lint-standards.ts`

### C8–C10: Swagger / Validation Decorators
- **Enforced by:** Code review (advisory)

---

## Category D — Code Style & Frontend Patterns

### D1: No Non-Null Assertions
- **Rule:** Never use `!` operator.
- **Enforced by:** Add `@typescript-eslint/no-non-null-assertion: 'error'` to ESLint config

### D6: No Direct Fetch in Components
- **Enforced by:** ESLint `@old-st/no-direct-fetch-in-components` (error)

### D7–D10: UI Primitives / Mobile Patterns
- **Enforced by:** Code review (advisory)

---

## Category E — Infrastructure & CI

### E1: Coverage Thresholds
- **Rule:** Domain 80%, services 70%, frontend 70%.
- **Enforced by:** Per-project `jest.config` `coverageThreshold`

### E2: Module Boundaries
- **Enforced by:** ESLint `@nx/enforce-module-boundaries`

### E5: Service Registry Sync
- **Rule:** Every API service with an HTTP target in `apps/` must be registered in `.github/service-registry.json`.
- **Enforced by:** CI `lint-standards.ts` → `service-registry-sync` check

### E8: STAGE=local Only
- **Enforced by:** ESLint + CI (same as B8)

### E10: Barrel Export Completeness
- **Rule:** Every leaf `src/` subfolder in `packages/` that contains `.ts` files must have an `index.ts` barrel export. Excludes `use-cases/` subdirectories (single-file-per-folder pattern).
- **Enforced by:** CI `lint-standards.ts` → `barrel-export-completeness` check (warning, not error)
- **Override:** Toggle `'barrel-export-completeness': false` in `coding-standards.config.ts`

### E11: Service Registry Env Sync
- **Rule:** SQS queue URL, DynamoDB table name, and database URL env vars referenced in a service's module code must be declared in both `service-registry.json` `envVars[]` (for Terraform injection into Lambda) and `service-registry.env` (for CI E2E values). Prevents the scenario where E2E passes but Lambda crashes silently.
- **Enforced by:** CI `lint-standards.ts` → `service-registry-env-sync` check
- **Override:** Toggle `'service-registry-env-sync': false` in `coding-standards.config.ts`

### E12: No Legacy AI-Config References
- **Rule:** No tracked file may contain a pre-migration "AI config" signal — a "Copilot" tool-name reference, an old `.github/{prompts,skills,agents,instructions}/` path, an old `.prompt.md` / `.agent.md` / `.instructions.md` / `.chatmode.md` file convention, an `applyTo:` / `runSubagent(` directive, a parallel AI-tool agent-config directory (`.cursor/`, `.opencode/`, `.windsurf/`), or the legacy `.copilot/` spec dir (renamed `.specs/`). Claude Code (`.claude/`, `CLAUDE.md`) is the single source of truth. Keeps the Copilot → Claude Code migration (ADR-008) at 100% and blocks regressions — including the auto-generated parallel agent dirs that previously kept reappearing.
- **Enforced by:** CI `lint-standards.ts` → `no-legacy-ai-config-references` check, which shells out to `scripts/audit-ai-config.mjs` (a `git ls-files` scan). Also runs in the husky `pre-commit` + `pre-push` hooks. Run manually with `pnpm audit:ai-config`.
- **Allowlist (intentional keepers):** `docs/decisions/007-*` + `008-*` (migration record), `.mcp.json` (GitHub MCP endpoint), `examples/` (frozen snapshot), and the scanner/standards files themselves. Edit the `ALLOWLIST` in `scripts/audit-ai-config.mjs` to extend. _(Note: the repo's own spec/schema system was renamed `.copilot/` → `.specs/` for clarity — the old `.copilot` name is now a forbidden pattern.)_
- **Override:** Toggle `'no-legacy-ai-config-references': false` in `coding-standards.config.ts`

---

## Category F — Persistence Patterns

### F4: Prisma Enums Mirror Domain Constants
- **Enforced by:** CI `lint-standards.ts` → `prisma-enum-domain-sync` check

### F1–F3, F5–F10: Pagination / Repository Patterns
- **Enforced by:** Code review (advisory)

---

## New Standards (Template Extensions)

### N1: All Events Handled by Dedicated Event Handler Service
- **Rule:** SQS/event handling logic must live in `*-event-handler-service` apps, not HTTP API services.
- **Enforced by:** ESLint `@old-st/require-event-handler-service` (error) + CI `lint-standards.ts`
- **Override:** `'@old-st/require-event-handler-service': 'off'`

### N2: All File Operations via file-api-service
- **Rule:** S3, multer, and file stream operations must be routed through the file-api-service.
- **Enforced by:** ESLint `@old-st/require-file-api-service` (off by default, enable when service exists)
- **Override:** `'@old-st/require-file-api-service': 'error'` to enable

---

## Per-Project Customization

### ESLint Plugin Overrides

```js
// Project eslint.config.mjs
import oldStPlugin from '@old-st/eslint-plugin';

export default [
  ...oldStPlugin.configs.recommended,
  {
    rules: {
      // Disable a rule for this project
      '@old-st/require-file-api-service': 'off',
      // Add project-specific allowed values
      '@old-st/no-hardcoded-status-strings': ['error', {
        allowed: ['CUSTOM_STATUS'],
      }],
    },
  },
];
```

### CI Check Overrides

```ts
// coding-standards.config.ts
export default {
  checks: {
    'prisma-enum-domain-sync': false,  // No Prisma in this project
    'event-handler-service-exists': true,
  },
};
```

### Review Overrides

Edit `docs/code-review-guidelines.md` to add/remove/adjust review standards per project.

---

## Adding a New Standard

1. **If lint-able:** Add a rule to `packages/eslint-plugin/src/rules/`, register in `index.js`, add to configs
2. **If structural:** Add a check to `scripts/lint-standards.ts`, add toggle to `coding-standards.config.ts` — use the **`add-structural-lint-check` skill** for step-by-step instructions and ready-to-use templates
3. **If judgment-based:** Add to `docs/code-review-guidelines.md`
4. **If API design:** Add to `.spectral.yml`
5. **Always:** Document in this file with enforcement method and override instructions
6. **Version bump:** Update `MIGRATION.md` in the ESLint plugin with the new rule

> **Skill:** Ask Claude Code to *"add a new structural coding standards check"* — it will load the `add-structural-lint-check` skill and guide you through the implementation with correct function templates, naming conventions, and test commands.
