---
description: "Scaffold a new DynamoDB-backed domain with minimal interview. Same as /new-domain but assumes persistence=dynamodb and skips the Prisma decision question. USE WHEN user explicitly says 'new dynamodb domain', 'add a dynamo-backed domain', or has already decided on DynamoDB and wants the fast path."
---

# New DynamoDB Domain — Guided Workflow

This is a focused variant of `/new-domain` that hard-codes
`persistence=dynamodb`. Use it when the user has already decided on DynamoDB
OneTable and wants to skip the persistence-decision interview.

For the full multi-persistence flow, use `/new-domain` instead.

**Do NOT call the generator until Phase 0 is complete.**

---

## Phase 0 — Source Selection

Ask how the spec is provided:

```
How would you like to define the domain spec?

  A. I have a spec YAML file → paste the path
     (e.g. .specs/domain-invoice.yaml)
  B. Generate a template, I'll edit it, then resume
     → run /new-domain-spec, then re-run /new-domain-dynamo with the path
  C. Interview me inline (current flow)
```

**Branching:**

- **A:** Load skill `.claude/skills/parse-domain-spec/SKILL.md` and run it on the path. **Reject the spec if `persistence: prisma`** — this prompt only handles DynamoDB. Ask user to use `/new-domain` instead. Otherwise, jump to Phase 0.5 with the loaded spec.
- **B:** Tell the user to run `/new-domain-spec`, then **stop**.
- **C:** Continue with the inline interview below.

---

## Phase 0 — Interview (Path C only)

Ask the user the following in a single structured message and wait for answers.

1. **Domain name** — singular lowercase kebab-case (e.g. `shipping`, `payment`).
2. **Entity name** — defaults to the domain name; ask only when they differ (e.g. domain `shipping`, entity `shipment`).
3. **Fields** — `name:type[?]` comma-separated. Allowed: `string|number|boolean|date`. `?` marks optional.
4. **Statuses** — comma-separated CONSTANT_CASE list, or `none` for stateless entities.
5. **Use cases** — subset of `create,get-by-id,update,delete,list`. Default: `create,get-by-id,list`.
6. **Business rules** — capture verbatim; AI will implement in Phase 3.
7. **Cross-service / events / frontend** — capture once, defer to later phases.

**Persistence is fixed:** `dynamodb`. Do not ask the user to choose.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: new-domain-package, new-domain-entity, domain-business-rules, new-dynamo-schema, dynamo-repository, nestjs-service-layers, write-domain-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain=user, thoroughness=quick")` — user-domain is the closest existing DynamoDB pattern.
- `Agent(subagent_type="port-claim-checker", prompt="mode=next-port, newServiceName={domain}")`

---

## Phase 1 — Dry-run preview

```bash
pnpm nx g @mma/nx-plugin:domain \
  --name={domain} \
  --entity={entity} \
  --persistence=dynamodb \
  --fields="{fields}" \
  --statuses="{statuses}" \
  --useCases="{useCases}" \
  --dryRun
```

Show the file plan. Ask: **"Proceed? (yes / refine / cancel)"**

---

## Phase 2 — Generate

Drop `--dryRun` and re-run. Then:

- [ ] `pnpm install`
- [ ] `Bash` on the generated tree.
- [ ] Confirm `packages/{domain}-domain/TODO.md` exists.

---

## Phase 3 — Refinement (delegated)

From here on, the workflow is **identical** to `/new-domain` Phases 3–10:

- Phase 3 — Business rules → load `domain-business-rules` skill.
- Phase 4 — Action use cases → `pnpm nx g @mma/nx-plugin:use-case ...`.
- Phase 5 — Contracts refinement → load `add-contracts` skill.
- Phase 6 — Service wiring → load `add-api-endpoints`, `swagger-controller-docs`, `domain-exception-filter`, `gateway-jwt-auth`.
- Phase 7 — Cross-service / async (if applicable).
- Phase 8 — Frontend (if applicable).
- Phase 9 — Tests → load `write-domain-tests`.
- Phase 10 — Local startup: `pnpm run localstack:setup:force && pnpm nx serve {domain}-api-service`.

Refer to `.claude/commands/new-domain.md` for the detailed phase
instructions and validation gates.

---

## Final Verification

```bash
pnpm exec nx run-many -t test build --projects={domain}-domain,{domain}-api-service --skip-nx-cache
```

Confirm tests pass, build succeeds, and `TODO.md` is checked off.

## Phase X — Post-Validate (parallel subagents)

- `Agent(subagent_type="dependency-auditor", prompt="scope=apps/{domain}/**,packages/{domain}-domain/**,packages/contracts/{domain}/**")`
- `Agent(subagent_type="golden-rule-validator", prompt="scope=service:{domain}-api-service, ruleSet=http-service")`
- `Agent(subagent_type="port-claim-checker", prompt="mode=audit")`
