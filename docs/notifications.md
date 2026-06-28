# Notifications & Alerting

CloudWatch alarms trigger notifications via the `infra/modules/notifications` Terraform module. Out of the box this template supports **email** and **Slack** per environment.

The notification configuration lives in `infra/notification-config.json` at the repo root.

---

## Configuration

```json
// infra/notification-config.json
{
  "dev": {
    "emails": ["alerts-dev@example.com"],
    "slack": {
      "workspaceId": "T0XXXXXXX",
      "channelId": "C0XXXXXXX"
    }
  },
  "staging": {
    "emails": ["alerts-staging@example.com"],
    "slack": { "workspaceId": "T0XXXXXXX", "channelId": "C0YYYYYYY" }
  },
  "prod": {
    "emails": ["oncall@example.com", "platform-alerts@example.com"],
    "slack": { "workspaceId": "T0XXXXXXX", "channelId": "C0ZZZZZZZ" }
  }
}
```

Each environment is independent — leave `emails: []` and empty `slack` strings to disable notifications for that environment.

---

## Architecture

```
CloudWatch Alarm  ─→  SNS Topic (per environment)
                        ├──→  Email subscription(s)
                        └──→  AWS Chatbot Slack channel configuration
                                ↓
                              Slack channel
```

**Resources created** (per environment, by `infra/modules/notifications`):

| Resource | Purpose |
|---|---|
| `aws_sns_topic.alerts` | Single topic that all alarms publish to |
| `aws_sns_topic_subscription.email[*]` | One subscription per email in `notification-config.json` |
| `aws_chatbot_slack_channel_configuration` (when slack configured) | Routes SNS → Slack via AWS Chatbot |
| `aws_iam_role.chatbot` | Role assumed by Chatbot for SNS subscription |

The `infra/modules/monitoring` module passes the SNS topic ARN to every alarm's `alarm_actions`.

---

## First-Time Setup

### 1. Email subscriptions

After the first `terraform apply` that creates SNS subscriptions, AWS sends a **confirmation email** to each address. Click the **Confirm subscription** link or the alarm will be created but messages will not arrive.

You can re-trigger the confirmation email from the SNS console: **Topics → `{env}-alerts` → Subscriptions → request confirmation**.

### 2. Slack channel (one-time per AWS account)

AWS Chatbot requires a one-time manual handshake to authorize the Slack workspace. **Terraform cannot do this step** — Slack must explicitly grant AWS Chatbot the OAuth permissions.

Steps (per AWS account):

1. Open the **AWS Chatbot console** in the target account.
2. Click **Configure new client** → choose **Slack**.
3. Click **Configure** — you'll be redirected to Slack for OAuth approval.
4. Approve the AWS Chatbot app for your workspace.
5. After approval, return to AWS Chatbot. Note the **Workspace ID** (e.g. `T0XXXXXXX`) shown in the console.
6. In Slack, **invite `@aws`** to each channel that should receive alerts:
   ```
   /invite @aws
   ```
7. Right-click the channel name in Slack → **View channel details** → copy the **Channel ID** at the bottom (e.g. `C0XXXXXXX`).
8. Update `infra/notification-config.json` with the Workspace ID + Channel ID for the matching environment.
9. Run `cd-deploy.yml` — Terraform creates `aws_chatbot_slack_channel_configuration` and routes the SNS topic to your channel.

### 3. Test the wiring

After deployment, send a test SNS message to confirm both channels work:

```sh
aws sns publish \
  --topic-arn arn:aws:sns:eu-west-2:123456789012:dev-alerts \
  --subject "Test alarm" \
  --message "If you see this in Slack and email, notifications work."
```

---

## Adding a New Notification Channel (PagerDuty, Opsgenie, etc.)

The `infra/modules/notifications` module currently supports email + Slack. To add a new channel:

1. Add the resource (e.g. `aws_sns_topic_subscription` with `protocol = "https"` for PagerDuty webhooks) to `infra/modules/notifications/main.tf`.
2. Add the configuration shape to `infra/notification-config.json` and pass it through the module's variables.
3. Document the manual setup steps (e.g. PagerDuty service integration URL) in this file.

> **Skill:** the `add-notifications` skill covers wiring a new channel end-to-end.

---

## Environment-Specific Routing

Different alert severities can be routed to different channels by:

1. Creating multiple SNS topics in the notifications module (e.g. `alerts`, `critical-alerts`).
2. Subscribing different emails / Slack channels to each.
3. Updating `infra/modules/monitoring` to choose a topic per alarm severity (e.g. `LambdaErrors` → `critical-alerts`, `LambdaDurationHigh` → `alerts`).

Currently every alarm uses a single per-environment topic.

---

## Cost

| Channel | Cost |
|---|---|
| SNS email | First 1,000 emails/month free; \$2.00 per 100,000 thereafter |
| AWS Chatbot Slack | Free |
| SNS topic | Free |
