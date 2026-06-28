---
description: "Extend the internal monitoring tool with a new endpoint, view, AWS data source, or trace exploration feature. USE WHEN user says 'add to monitoring tool', 'extend monitoring dashboard', 'add ECS metrics view', 'monitoring tool needs', 'show {AWS service} in dashboard', 'new monitoring page', or 'monitoring API endpoint'."
---

# Add Monitoring Feature — Guided Workflow

You are orchestrating the addition of a new feature to the **internal monitoring tool** (`apps/monitoring/monitoring-api-service/` + `apps/monitoring/monitoring-webapp/`).

> **Important:** This is for the **internal observability dashboard** — used by operators to inspect production state across environments. It is NOT a feature for end users. If the user is asking to add monitoring to a customer-facing app, use `add-alerting` (CloudWatch alarms) or `add-monitoring` (telemetry wiring) instead.

**Do NOT generate any code until Phase 0 is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message:

1. **What new view/data should the dashboard show?** (e.g. "ECS service health", "API Gateway request counts", "RDS slow queries", "Lambda cold-start times")

2. **Which AWS service does this data come from?** (CloudWatch / X-Ray / Lambda / ECS / RDS / API Gateway / etc.)

3. **Read scope:**
   - Is this read-only? *(Should always be yes — monitoring tool is read-only by design)*
   - What AWS API actions are needed? (e.g. `ecs:ListServices`, `cloudwatch:GetMetricData`)

4. **UI shape:**
   - New top-level page (sidebar entry)? Or a panel inside an existing page?
   - List view, time-series chart, single metric card, or something else?

5. **Which environments need it?** (dev only / all environments)

6. **Existing provider check:**
   - Does `packages/monitoring-sdk/src/providers/` already have a provider for this AWS service?
   - If yes, is the needed method already exposed? (If yes, skip Phase 2 and go directly to Phase 3.)

**Do not proceed until all questions are answered.**

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: add-monitoring, extend-monitoring-service")`
- `Agent(subagent_type="monitoring-tracer", prompt="mode=all")` — surfaces existing alarms and any logger violations to avoid duplication.

---

## Phase 1 — IAM Verification

The monitoring tool uses an **AssumeRole** pattern — `monitoring-api-service` in the monitoring account assumes a `monitoring-readonly` role in each target environment account.

The target role's IAM policy MUST include the new AWS API actions before the feature can work. Verify:

```hcl
# infra/environments/{env}/monitoring/iam.tf (or similar)
data "aws_iam_policy_document" "monitoring_readonly" {
  statement {
    sid       = "EcsRead"  # example
    effect    = "Allow"
    actions   = ["ecs:ListClusters", "ecs:ListServices", "ecs:DescribeServices"]
    resources = ["*"]
  }
}
```

If the new actions are not in the policy, add them. They will be deployed via `cd-monitoring-deploy.yml`.

---

## Phase 2 — Add SDK Provider (if needed)

**Skip if** `packages/monitoring-sdk/src/providers/` already has a provider for this service AND the needed method exists.

**Load skill:** `.claude/skills/extend-monitoring-service/SKILL.md` (Part 2 — Add Provider)

Steps:
1. Add `@aws-sdk/client-{name}` to `packages/monitoring-sdk/package.json`
2. Create `packages/monitoring-sdk/src/providers/{name}.provider.ts`
3. Export from `packages/monitoring-sdk/src/index.ts`
4. Run `pnpm install`

**Validation:** `pnpm nx test monitoring-sdk` passes (write a basic provider test).

---

## Phase 3 — Add API Service Method + Controller

**Load skill:** `.claude/skills/extend-monitoring-service/SKILL.md` (Parts 4 & 5)

Steps:
1. Create `apps/monitoring/monitoring-api-service/src/application/services/{name}.service.ts`
   - Inject `AwsClientFactory`
   - Use `createLogger('{name}-service')` (Golden Rule #35)
2. Create `apps/monitoring/monitoring-api-service/src/presentation/controllers/{name}.controller.ts`
   - Read `@Headers('x-target-environment') targetEnv: string`
   - JWT auth is automatic (`APP_GUARD`)
3. Wire into a module (`apps/monitoring/monitoring-api-service/src/modules/{name}.module.ts`)
4. Import the module from `AppModule`

**Validation:**
- `pnpm nx test monitoring-api-service` passes
- `pnpm nx build monitoring-api-service` succeeds
- Run `pnpm nx serve monitoring-api-service` and `curl -H 'Authorization: Bearer <token>' -H 'X-Target-Environment: dev' http://localhost:8080/api/{endpoint}`

---

## Phase 4 — Add Webapp Hook + Page

**Load skill:** `.claude/skills/extend-monitoring-service/SKILL.md` (Parts 6 & 7)

Steps:
1. Add a typed hook to `apps/monitoring/monitoring-webapp/src/lib/use-monitoring-api.ts`
2. Create `apps/monitoring/monitoring-webapp/src/app/{route}/page.tsx`
3. Add navigation entry to the dashboard layout/sidebar
4. If a chart is needed, use the existing chart components in `apps/monitoring/monitoring-webapp/src/components/`

**Validation:**
- `pnpm nx test monitoring-webapp` passes
- `pnpm nx build monitoring-webapp` succeeds
- Run `pnpm nx dev monitoring-webapp` and navigate to the new route

---

## Phase 5 — Local End-to-End Test

The monitoring tool requires **real AWS credentials** in your shell — there is no LocalStack option for it.

```sh
aws sso login --profile dev-readonly
export AWS_PROFILE=dev-readonly

# Run task: "Monitoring: Start All"
# Open http://localhost:4300
# Sign in
# Navigate to your new view
# Verify data loads from the dev account
```

---

## Phase 6 — Deploy

```sh
# Trigger via VS Code task: "Monitoring Deploy: Trigger"
# Select target environment
# Wait for cd-monitoring-deploy.yml to finish
```

The workflow:
1. Builds + pushes Docker images for `monitoring-api-service` and `monitoring-webapp`
2. Applies `infra/environments/{env}/monitoring/` Terraform (picks up the new IAM permissions)
3. Updates Lambda function code

**Validation after deploy:**
- Open the deployed monitoring URL
- Navigate to the new view
- Confirm data loads from the deployed environment

---

## Phase Final — Verification Checklist

- [ ] IAM policy for `monitoring-readonly` role includes the new AWS API actions (in every target environment)
- [ ] SDK provider added (or verified existing) and exported from `monitoring-sdk` barrel
- [ ] Application service uses `createLogger()` and injects `AwsClientFactory`
- [ ] Controller declares `@Headers('x-target-environment')`
- [ ] Module registers the service + controller and is imported by `AppModule`
- [ ] Webapp hook added to `use-monitoring-api.ts`
- [ ] Dashboard page added under `apps/monitoring/monitoring-webapp/src/app/`
- [ ] Sidebar navigation entry added
- [ ] Tests pass: `pnpm nx test monitoring-sdk monitoring-api-service monitoring-webapp`
- [ ] Builds succeed: `pnpm nx build monitoring-sdk monitoring-api-service monitoring-webapp`
- [ ] Local smoke test passes against a real AWS account
- [ ] Deployed via `cd-monitoring-deploy.yml`
- [ ] Verified working in deployed environment

---

## Out-of-Scope Reminders

- ❌ **Do not add write operations** to the monitoring tool. It is read-only by design.
- ❌ **Do not expose monitoring data to end users.** Internal operators only.
- ❌ **Do not use this pattern for customer-facing observability features** — those should use `add-monitoring` skill (telemetry wiring) and `add-alerting` (notifications) instead.
- ❌ **Do not add the new permissions to a write-capable role.** Always use the dedicated read-only role.
