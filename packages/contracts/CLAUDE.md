# @old-st/contracts Package Context

This file loads automatically for any file inside `packages/contracts/`. The package is the **API surface contract** between backend services, the webapp, and the mobile app — Zod schemas + TypeScript types + event schemas + domain enum re-exports.

---

## Layout

Each domain has its **own independent package** under `packages/contracts/{domain}/`:

```
packages/contracts/
  common/        ← shared pagination interfaces (cursor + offset)
  auth/          ← @old-st/contracts/auth
  {domain}/      ← @old-st/contracts/{domain}
```

Every domain folder contains:
- `package.json` (depends on `@old-st/{domain}-domain` + `zod`)
- `project.json` (Nx tags `scope:{domain}` + `type:contracts`)
- `tsconfig.json`
- `src/index.ts` — barrel
- `src/schemas.ts` — request / response Zod schemas + inferred types
- `src/event-schemas.ts` (when the domain publishes events) — discriminated-union event payloads

---

## Architectural Rules (Strictly Enforced)

1. **Never import from the bare `@old-st/contracts` root** (Golden Rule #11). Always use a domain subpath: `@old-st/contracts/{domain}` (or `@old-st/contracts/common`). Enforced by the `no-bare-contracts-import` lint check (`scripts/lint-standards.ts`).

2. **A contracts package only depends on its OWN domain package.** `@old-st/contracts/{domain}` may depend on `@old-st/{domain}-domain` but NEVER on another domain's package. Cross-domain coupling is forbidden — that is the entire reason contracts are split per-domain.

3. **Zod schemas are the single source of truth for runtime validation.** Both the backend (`ZodValidationPipe`) and the frontend (`apiRequest({ schema })` + `react-hook-form` resolver) consume the same schema. Never duplicate validation logic.

4. **Re-export domain enum constants** (`UserStatusEnum`, `OrderStatusEnum`, etc.) from contracts so frontend code can use enums without depending on the domain package. The enum object lives in `@old-st/{domain}-domain/domain/constants` and is re-exported as a value from the contracts package.

5. **Types are inferred from schemas** via `z.infer<typeof xxxSchema>` — never hand-written interfaces.

6. **Event schemas use discriminated unions** with a `type` field per event — see `sqs-event-driven-service` skill.

7. **`pagination.ts`** in `packages/contracts/common/` defines `IPaginatedResponse` (cursor) and `IOffsetPaginatedResponse` (offset). Never define new pagination shapes in a domain — extend these.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Adding / changing schemas for an existing domain | `add-contracts` |
| Creating a new domain's contracts package | `add-contracts` + `contracts-subpath-imports` |
| Auditing import paths across the repo | `contracts-subpath-imports` |
| Adding event schemas (discriminated union) | `sqs-event-driven-service` |
| Auditing the impact of a contract change on consumers | Run the `contract-diff-analyzer` subagent |

**Always read the relevant skill BEFORE editing this package.**

---

## Pre-Merge Check

Any change to a contracts package should run the `contract-diff-analyzer` subagent against the PR diff to classify the change as **additive** (safe), **tightening** (breaking), or **removal** (breaking) and to enumerate every affected call site (webapp hooks, mobile, backend pipes/filters).
