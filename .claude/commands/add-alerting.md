---
description: "Add a new alerting/notification channel to the platform — PagerDuty, Opsgenie, MS Teams, additional Slack channels, or wire CloudWatch alarms to a new service. USE WHEN user says 'add alerting', 'set up alerts', 'PagerDuty', 'Opsgenie', 'Slack alerts', 'on-call notifications', 'wire up alarms', or 'add notification channel'."
---

# Add Alerting — Guided Workflow

You are orchestrating the addition of alerting / notification capabilities. This covers two distinct goals:

1. **Adding a new notification channel** (PagerDuty, Opsgenie, Teams, Discord, additional Slack workspace) — extends the `notifications` Terraform module.
2. **Wiring CloudWatch alarms to a new service** — connects an existing service's Lambdas + DLQs to the existing alarm pipeline.

These are different jobs. Phase 0 disambiguates.

**Do NOT generate any code until Phase 0 is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message:

1. **What's the goal?**
   - **A)** Add a new channel type (PagerDuty / Opsgenie / Teams / Discord / SMS / etc.)
   - **B)** Add CloudWatch alarms to an existing service that doesn't yet have them
   - **C)** Add another email or another Slack channel to existing channel types — *(this is just an edit to `infra/notification-config.json`, no code change)*

2. **Target environments** — which environments should receive these alerts? (dev / staging / prod / all)

3. **(For goal A) Channel-specific setup:**
   - PagerDuty: do you have an Events API integration URL?
   - Opsgenie: do you have an API key?
   - Slack: do you have the workspace ID + channel ID?
   - Teams / Discord: webhook URL? (note: requires a Lambda relay — confirm before proceeding)

4. **(For goal B) Service identification:**
   - Service name (e.g. `payment-api-service`)
   - Lambda function name(s)
   - SQS DLQ name(s) if event-driven
   - Severity — should errors page on-call (PagerDuty) or just notify a channel (Slack)?

5. **(For goal A) Alarm routing** — should this new channel receive ALL alarms, or only critical ones?

**Do not proceed until all relevant questions are answered.**

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: add-monitoring, add-notifications")`
- `Agent(subagent_type="monitoring-tracer", prompt="mode=alarms")` — lists alarms already wired so you don't duplicate them.

---

## Path A — New Channel Type

### Phase A1 — Pre-flight Verification

- Confirm the channel's manual setup is complete (PagerDuty integration created, Slack OAuth approved, etc.)
- If user picked Teams/Discord and DOES NOT want to deploy a relay Lambda, stop and explain that direct webhook delivery from SNS is not supported. Suggest using AWS Chatbot Slack as an alternative.

### Phase A2 — Implement

**Load skill:** `.claude/skills/add-notifications/SKILL.md`

Follow it end-to-end:
1. Update `infra/notification-config.json` schema for new channel
2. Add variable to `infra/modules/notifications/variables.tf`
3. Add resource to `infra/modules/notifications/main.tf`
4. Wire the variable in every `infra/environments/{env}/main.tf`
5. Smoke-test via `aws sns publish`
6. Update `docs/notifications.md` with the new channel section

### Phase A3 — Validate

- Run `terraform plan` in each environment and confirm only expected changes
- After apply, send a test alarm message and confirm delivery

---

## Path B — Wire Alarms to a Service

### Phase B1 — Pre-flight Verification

- Confirm the service is **already deployed** (i.e. `service-registry.json` already lists it). If not, redirect user to `/new-service` first.
- Confirm the service uses `createLogger()` from `@mma/telemetry` (Golden Rule #35). If not, alarms will fire but logs will be unsearchable.

### Phase B2 — Implement

**Load skill:** `.claude/skills/add-monitoring/SKILL.md`

Follow it end-to-end:
1. Add the service's Lambda function name to `lambda_functions` map in each environment's `module "monitoring"` call
2. Add the service's DLQ name (if event-driven) to the `dlq_arns` map
3. Verify per-service alarm thresholds are appropriate (defaults: 1 error / 5 min, 1 DLQ message / 5 min)

### Phase B3 — Validate

- `terraform plan` in target environment — confirm only new alarm resources
- After apply, manually trigger a Lambda error (e.g. POST a malformed payload) and confirm:
  - CloudWatch alarm transitions to ALARM state within 5 min
  - SNS topic receives the message
  - Notification arrives in the configured channels (email, Slack, etc.)

---

## Phase Final — Verification

Regardless of path:

- [ ] `terraform plan` from each affected environment is clean (no unexpected diffs)
- [ ] `pnpm nx affected --target=test` passes (no test changes typically)
- [ ] `docs/notifications.md` updated if a new channel was added
- [ ] `infra/notification-config.json` updated with channel config
- [ ] Smoke test confirms end-to-end alert delivery

---

## Composition with Other Workflows

If the user describes a workflow that includes alerting as a sub-step, this prompt may be invoked as a sub-phase by a larger orchestrator (e.g. `new-service` → wire monitoring + alerting). Do not refuse to handle a sub-task — but re-ask the Phase 0 questions to ensure the channel/service is correctly scoped before applying skills.
