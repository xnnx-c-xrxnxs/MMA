---
description: "Fast-scaffold a complete CRUD domain — no business-rule interview, no AI refinement loop. Generates create/get-by-id/update/delete/list use cases out of the box. USE WHEN user says 'quick crud domain', 'simple crud domain', 'just a basic crud entity', 'minimal new domain', or wants a working endpoint surface in the shortest possible time."
---

# Quick CRUD Domain — Fast-Path Workflow

You are scaffolding a **plain CRUD domain** with the minimum viable interview.
This skips the business-rules elicitation and contracts refinement loop —
generated code is good-enough-to-run-locally and can be enriched later via
`/new-feature` or the `domain-business-rules` skill.

**When to NOT use this:** if the user has any of these, route to `/new-domain` instead:
- State machines / status transitions beyond a simple ACTIVE/DELETED toggle.
- Cross-service sync calls (ACL).
- Event publishing or consuming.
- Rich validation rules (regex, range, conditional required fields).

---

## Phase 0 — Source Selection

Ask:

```
How would you like to define the entity?

  A. I have a spec YAML file → paste the path
     (e.g. .specs/domain-tag.yaml)
  B. Generate a template, I'll edit, resume → /new-domain-spec
  C. Quick interview (3 questions — best for plain CRUD)
```

- **A:** Load skill `.claude/skills/parse-domain-spec/SKILL.md`. Reject if `persistence: prisma` (this prompt is DynamoDB-only) or if `businessRules` is non-empty (route to `/new-domain` instead — quick CRUD does not implement rules). Otherwise jump to Phase 0.5.
- **B:** Tell the user to run `/new-domain-spec`, then stop.
- **C:** Continue below.

---

## Phase 0 — Minimal interview (Path C only)

Ask **only** these in a single message:

1. **Domain name** — singular lowercase kebab-case.
2. **Entity name** — defaults to domain name; ask only on mismatch.
3. **Fields** — `name:type[?]` comma-separated. `string|number|boolean|date`. `?` for optional.

That's it. The generator defaults the rest:

| Knob | Default |
|---|---|
| `persistence` | `dynamodb` |
| `statuses` | `ACTIVE,DELETED` (auto-generates `markAsDeleted`/`isDeleted` getters) |
| `useCases` | `create,get-by-id,update,delete,list` |
| `withService` | `true` |
| `withContracts` | `true` |

**Do not ask about business rules, cross-service, or frontend.** They are
intentionally out of scope for this prompt.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: new-domain-package, new-dynamo-schema, dynamo-repository")`
- `Agent(subagent_type="port-claim-checker", prompt="mode=next-port, newServiceName={domain}")`

---

## Phase 1 — Generate

No dry-run preview — speed is the point of this prompt. Run directly:

```bash
pnpm nx g @old-st/nx-plugin:domain \
  --name={domain} \
  --entity={entity} \
  --fields="{fields}" \
  --useCases="create,get-by-id,update,delete,list"
```

The generator emits ~60 files: domain package + contracts + service shell + 5
use cases, and updates `tsconfig.base.json`, `service-registry.json`,
`scripts/setup-localstack.ts`, `.env.local.example`, and `.vscode/tasks.json`.

If the generator fails because the domain or contracts package already exists,
report the conflict and ask the user how to proceed (rename or abort).

---

## Phase 2 — Wire the service

The service generator emits commented-out provider blocks. Hand-edit only the
two files that need to know all 5 use cases:

### 2a — `apps/{domain}/{domain}-api-service/src/modules/{entity}.module.ts`

Uncomment the provider blocks. Add a `useFactory` provider for **each** of:
`Create{Entity}UseCase`, `Get{Entity}UseCase`, `Update{Entity}UseCase`,
`Delete{Entity}UseCase`, `List{EntityPlural}ByStatusUseCase`. All inject
`{DOMAIN_PLURAL}_REPOSITORY`.

### 2b — `apps/{domain}/{domain}-api-service/src/application/services/{entity}-application.service.ts`

Replace the `ping` method with five public methods that delegate to the
respective use cases and return `{ResponseSchema}.parse(entity)` DTOs. Use the
existing user-application.service.ts as the reference shape.

### 2c — `apps/{domain}/{domain}-api-service/src/presentation/controllers/{entity}.controller.ts`

Replace the placeholder `GET /ping` with five REST routes following the
template. Annotate with Swagger decorators per the
`swagger-controller-docs` skill (load on demand).

| Verb | Path | Application service method |
|---|---|---|
| `POST` | `/{plural}` | `create()` |
| `GET` | `/{plural}/:id` | `getById()` |
| `PATCH` | `/{plural}/:id` | `update()` |
| `DELETE` | `/{plural}/:id` | `delete()` |
| `GET` | `/{plural}` | `list()` (cursor pagination) |

### 2d — Validation gate

```bash
pnpm exec nx build {domain}-api-service --skip-nx-cache
```

Must succeed. Fix all errors before continuing.

---

## Phase 3 — Smoke test

```bash
pnpm install
pnpm run localstack:setup:force
pnpm nx serve {domain}-api-service
```

Hit `http://localhost:{PORT}/api/health` → expect `{ status: "ok", service: "{domain}-api-service" }`.

If the user wants a one-liner sanity test, use the `task-helpers` curl pattern:

```bash
curl -X POST http://localhost:{PORT}/api/{plural} -H "Content-Type: application/json" -d '{...}'
```

(The user must supply a JWT token if `gatewayAuth.enabled` is true.)

---

## Phase 4 — Tests (minimal)

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache
pnpm exec nx test {domain}-api-service --skip-nx-cache
```

The generator emits placeholder specs that pass by default. **Do NOT** insist
on full coverage in this fast-path workflow — the placeholder coverage is
intentionally below threshold so the user is reminded to come back later via
`/new-feature` and add real cases.

If coverage gating blocks CI, document this in the PR description: *"CRUD
scaffold only — full test coverage tracked as follow-up via /new-feature."*

---

## Phase X — Post-Validate (parallel subagents)

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{domain}-api-service, ruleSet=http-service")`

Fix issues before declaring done.

---

## Final Summary

Report:
- Domain + entity name.
- Port claimed (read from `.env.local.example`).
- Endpoint surface (5 routes).
- Open `TODO.md` once and tell the user: **"Run `/new-feature` against this
  domain to add business rules, validation, and full test coverage."**

**This prompt does not load the `domain-business-rules`, `add-contracts`, or
`write-domain-tests` skills.** They are explicitly out of scope.
