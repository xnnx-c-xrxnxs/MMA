---
name: add-notifications
description: Add a new notification channel (PagerDuty, Opsgenie, MS Teams, additional Slack channel, etc.) to the notifications module so CloudWatch alarms publish to it. Use this when extending alarm fan-out beyond the default email + AWS Chatbot Slack delivery.
---

# Add a New Notification Channel

The `infra/modules/notifications/` Terraform module owns the SNS topic + subscriptions per environment. Out of the box it supports:

- Email subscriptions
- AWS Chatbot Slack channel configuration

This skill walks through adding a **new channel type**. For just adding more emails or a new Slack channel to an existing workspace, edit `infra/notification-config.json` — no code change needed.

Canonical references:
- `infra/modules/notifications/main.tf` — current resources
- `infra/modules/notifications/variables.tf` — input variables
- `infra/notification-config.json` — per-environment config consumed by every environment root

---

## When to Use This Skill

| Goal | Use this skill? |
|---|---|
| Add another email address to the dev environment | ❌ — just edit `notification-config.json` |
| Add a second Slack channel | ❌ — just add `slack: { ... }` array support to config |
| Route alarms to PagerDuty | ✅ — new channel type |
| Route alarms to Opsgenie | ✅ — new channel type |
| Route alarms to a webhook (Discord, Teams via webhook, etc.) | ✅ — new channel type |
| Send SMS via SNS | ✅ — new channel type |

---

## Part 1 — Pick the SNS Subscription Protocol

| Channel | SNS protocol | Endpoint format |
|---|---|---|
| Email | `email` | `alerts@example.com` |
| Slack (via AWS Chatbot) | _(not SNS — uses `aws_chatbot_slack_channel_configuration`)_ | _(workspace + channel ID)_ |
| PagerDuty | `https` | `https://events.pagerduty.com/integration/{key}/enqueue` |
| Opsgenie | `https` | `https://api.opsgenie.com/v1/json/amazonsns?apiKey={key}` |
| MS Teams (via webhook + relay) | `https` | Lambda URL that POSTs to Teams Incoming Webhook |
| Discord (via webhook + relay) | `https` | Lambda URL that POSTs to Discord Webhook |
| SMS | `sms` | `+15551234567` |

> **Warning:** SNS does **not** natively support MS Teams or Discord webhook formats. You must deploy a small Lambda relay that re-formats the SNS message body. This skill assumes a direct HTTPS subscription unless noted.

---

## Part 2 — Update `infra/notification-config.json`

Extend the per-environment shape. Example for PagerDuty:

```json
{
  "dev": {
    "emails": ["alerts-dev@example.com"],
    "slack": { "workspaceId": "T0XXX", "channelId": "C0XXX" },
    "pagerduty": {
      "integrationUrl": "https://events.pagerduty.com/integration/abcd1234/enqueue"
    }
  },
  "prod": {
    "emails": ["oncall@example.com"],
    "slack": { "workspaceId": "T0XXX", "channelId": "C0YYY" },
    "pagerduty": {
      "integrationUrl": "https://events.pagerduty.com/integration/efgh5678/enqueue"
    }
  }
}
```

Leave the field empty for environments that don't use the new channel.

---

## Part 3 — Update `infra/modules/notifications/variables.tf`

Add a new input variable:

```hcl
variable "pagerduty_integration_url" {
  description = "PagerDuty Events API integration URL. Leave empty to disable."
  type        = string
  default     = ""
  sensitive   = true
}
```

For non-sensitive endpoints, drop `sensitive = true`.

---

## Part 4 — Update `infra/modules/notifications/main.tf`

Add a conditional resource:

```hcl
resource "aws_sns_topic_subscription" "pagerduty" {
  count                  = var.pagerduty_integration_url != "" ? 1 : 0
  topic_arn              = aws_sns_topic.alerts.arn
  protocol               = "https"
  endpoint               = var.pagerduty_integration_url
  endpoint_auto_confirms = true
  raw_message_delivery   = false
}
```

`endpoint_auto_confirms = true` is required for PagerDuty — they auto-confirm the SNS subscription. For other providers that send a confirmation link to a human, leave it `false` (default).

For new resource types beyond `aws_sns_topic_subscription` (e.g., a Lambda relay for Teams), add the supporting Lambda + IAM role in the same file.

---

## Part 5 — Wire the Variable in Every Environment Root

Each `infra/environments/{env}/main.tf` calls `module "notifications"`. Update the call:

```hcl
locals {
  notifications = jsondecode(file("${path.module}/../../notification-config.json"))[var.environment]
}

module "notifications" {
  source = "../../modules/notifications"

  name_prefix              = "${var.project_name}-${var.environment}"
  emails                   = try(local.notifications.emails, [])
  slack_workspace_id       = try(local.notifications.slack.workspaceId, "")
  slack_channel_id         = try(local.notifications.slack.channelId, "")
  pagerduty_integration_url = try(local.notifications.pagerduty.integrationUrl, "")
}
```

Use `try(..., default)` so existing environments without the new channel keep working.

---

## Part 6 — Test the Wiring

After `terraform apply`:

```sh
aws sns publish \
  --topic-arn arn:aws:sns:eu-west-2:123456789012:dev-alerts \
  --subject "Test alarm" \
  --message '{"AlarmName":"test","NewStateValue":"ALARM","NewStateReason":"smoke test"}'
```

Confirm:
1. Email arrives.
2. Slack channel posts the alarm.
3. New channel (e.g. PagerDuty) creates an incident.

---

## Part 7 — Update `docs/notifications.md`

Add a section documenting the new channel:
- The config shape under `notification-config.json`
- Manual setup steps (e.g. PagerDuty service integration)
- The cost (per provider's free tier)

---

## Part 8 — Update `infra/modules/notifications/README.md` (if it exists)

List the new variable and the supported channel.

---

## Output Checklist

- [ ] `infra/notification-config.json` schema extended
- [ ] `infra/modules/notifications/variables.tf` — new variable added
- [ ] `infra/modules/notifications/main.tf` — conditional resource added
- [ ] All four `infra/environments/{dev,staging,prod,preview}/main.tf` files pass the new variable
- [ ] `terraform plan` from each environment is clean
- [ ] `docs/notifications.md` updated
- [ ] Smoke-test message confirmed delivery
