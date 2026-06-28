---
description: "Add a single use case to an existing domain — create, get-by-id, update, delete, action (state transition), or list. Powered by the @old-st/nx-plugin:use-case generator. USE WHEN user says 'add a use case', 'add an action to', 'cancel use case', 'mark X as Y', 'list X by Y', or any single-operation extension to an existing domain that does not need new fields or contracts."
---

# New Use Case — Guided Workflow

You are adding a single use case to an **existing** domain. Use the
`@old-st/nx-plugin:use-case` generator to scaffold the file + spec, then hand
off to the user (or yourself) to wire the use case into the application
service.

**For new state transitions, the entity method MUST already exist** before
running the generator with `--type=action`. If the user is asking for a brand
new state transition, prompt them to first add the method via the
`domain-business-rules` skill, then return to this workflow.

**Do NOT call the generator until Phase 0 is complete.**

---

## Phase 0 — Interview

Ask in a single message:

1. **Domain** — kebab-case (e.g. `shipping`, `order`, `user`).
2. **Entity** — defaults to domain name; ask only on mismatch.
3. **Use case shape** — pick one:

   | Shape | When to use |
   |---|---|
   | `create` | Create a new entity (uniqueness check + `Entity.create()` + save) |
   | `get-by-id` | Load by primary key, throw if missing |
   | `update` | Load + entity update method + save |
   | `delete` | Load + `entity.markAsDeleted()` + save |
   | `action` | State transition (cancel, dispatch, activate, …) — entity method must exist |
   | `list` | Filtered list with pagination |

4. **Verb** — kebab-case operation name (e.g. `cancel`, `dispatch`, `mark-failed`, `list-by-customer`).
   - For `action`: must match an existing entity method (`cancel` → `entity.cancel()`).
   - For `list`: typically describes the filter (`by-status`, `by-customer`).
5. **Filter field** (only for `type=list`) — defaults to `status`. Override only when listing by something else (e.g. `customerId`).
6. **Action method override** (only for `type=action`) — defaults to the verb. Override only when the entity method has a different name than the verb (rare).

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: new-use-case, domain-business-rules, sync-cross-service-call")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=all, thoroughness=medium")` — confirms entity methods, repository signatures, and existing use cases so the new one fits cleanly.

---

## Phase 1 — Generate

```bash
pnpm nx g @old-st/nx-plugin:use-case \
  --domain={domain} \
  --entity={entity} \
  --verb={verb} \
  --type={type}
```

For `--type=list` with non-default filter:

```bash
pnpm nx g @old-st/nx-plugin:use-case \
  --domain={domain} \
  --entity={entity} \
  --verb=list-by-customer \
  --type=list \
  --filterField=customerId
```

For `--type=action` with method override:

```bash
pnpm nx g @old-st/nx-plugin:use-case \
  --domain={domain} \
  --entity={entity} \
  --verb=mark-failed \
  --type=action \
  --actionMethod=markAsFailed
```

The generator emits:

- `packages/{domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.ts`
- `packages/{domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.spec.ts`
- Updates the `application/use-cases/index.ts` barrel.

If the use case already exists, the generator throws — confirm with the user
before deleting and re-running.

---

## Phase 2 — Fill in TODO blocks

Open the generated `.use-case.ts` file. Replace placeholder TODO blocks:

- **`create`**: replace `Entity.create({ ... })` argument list with the actual
  fields the entity needs.
- **`update`**: replace the call to `entity.update({...})` with the real
  update method on the entity.
- **`action`**: confirm the call site `entity.{actionMethod}()` matches the
  signature (some action methods take arguments).
- **`list`**: confirm the input shape includes the filter field, direction,
  and cursor parameters.

---

## Phase 3 — Wire the application service

Open `apps/{domain}/{domain}-api-service/src/application/services/{entity}-application.service.ts`.

- [ ] Inject the new use case in the constructor.
- [ ] Add a public method that calls it and returns a DTO via `{ResponseSchema}.parse(entity)`.

Open `apps/{domain}/{domain}-api-service/src/modules/{entity}.module.ts`.

- [ ] Add a `useFactory` provider for the new use case, injecting `{DOMAIN_PLURAL}_REPOSITORY`.

If this is an `action` use case and there is no controller route yet, add one
using the `add-api-endpoints` skill. Common pattern:
`POST /{plural}/:id/{verb}` with no request body for unary actions.

---

## Phase 4 — Tests

The generator emits a placeholder spec. Replace it with real cases:

- [ ] Happy path: input → `entity.{method}()` was called with the right args → `repo.save()` was called.
- [ ] Not-found: when `findById` returns `undefined`, throws `{Entity}NotFoundError`.
- [ ] Domain rule failure: when `entity.{method}()` throws (e.g. `CannotCancelDeliveredShipmentError`), the use case re-throws unchanged.
- [ ] (List only) Cursor routing — `direction: 'next'` vs `'prev'` maps to `nextCursorPointer` vs `prevCursorPointer`.

```bash
pnpm exec nx test {domain}-domain --skip-nx-cache
```

Must pass with coverage at or above 80%.

---

## Phase 5 — (Optional) Update contracts

Only if this use case introduces a new request or response shape:

- Load `.claude/skills/add-contracts/SKILL.md`.
- Add the new schema to `packages/contracts/{domain}/src/schemas.ts`.
- Re-run `pnpm exec nx build {domain}-api-service --skip-nx-cache` to confirm types compile.

---

## Phase X — Post-Validate (parallel subagents)

- `Agent(subagent_type="dependency-auditor", prompt="scope=packages/{domain}-domain/**,apps/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=domain:{domain}, ruleSet=domain")`
- `Agent(subagent_type="test-coverage-analyzer", prompt="project={domain}-domain")` — surfaces any branches missed by the new use case tests.

Fix any issues before declaring done.

---

## Final Summary

Report:
- The use case file path.
- Whether the application service + module were updated by the user, or if those steps are still TODO.
- Any new contract schemas added.
- Test status.
