# ─── Notifications Module ────────────────────────────────────────────────────
# Creates an SNS topic for CloudWatch alarm notifications with email and Slack
# delivery channels. Email subscribers receive raw alarm JSON. Slack receives
# formatted cards via AWS Chatbot.
#
# Prerequisites for Slack:
#   1. Authorize AWS Chatbot in your Slack workspace (one-time, via AWS Console).
#   2. Provide the Slack workspace ID and channel ID in notification-config.json.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

# ─── SNS Topic ──────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alarms" {
  name = "${var.name_prefix}-alarm-notifications"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alarm-notifications"
  })
}

# ─── SNS Topic Policy ──────────────────────────────────────────────────────
# Allow CloudWatch to publish alarm notifications to this topic.

resource "aws_sns_topic_policy" "alarms" {
  arn = aws_sns_topic.alarms.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudWatchAlarms"
        Effect    = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.alarms.arn
      }
    ]
  })
}

# ─── Email Subscriptions ───────────────────────────────────────────────────
# Each email address gets a subscription. AWS sends a confirmation email that
# the recipient must click once — after that, notifications flow automatically.

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.notification_emails)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

# ─── Slack via AWS Chatbot ─────────────────────────────────────────────────
# Conditional — only created when both slack_workspace_id and slack_channel_id
# are provided. AWS Chatbot formats CloudWatch alarm payloads into rich Slack
# messages with alarm name, state, metric, and links to CloudWatch console.

resource "aws_iam_role" "chatbot" {
  count = var.slack_workspace_id != "" && var.slack_channel_id != "" ? 1 : 0

  name = "${var.name_prefix}-chatbot-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "chatbot.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "chatbot" {
  count = var.slack_workspace_id != "" && var.slack_channel_id != "" ? 1 : 0

  name = "${var.name_prefix}-chatbot-policy"
  role = aws_iam_role.chatbot[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "logs:GetLogEvents",
          "logs:FilterLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:GetLogRecord",
          "logs:GetQueryResults",
          "logs:StartQuery",
          "logs:StopQuery"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:GetFunction",
          "lambda:ListFunctions",
          "lambda:GetFunctionConfiguration"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_chatbot_slack_channel_configuration" "alarms" {
  count = var.slack_workspace_id != "" && var.slack_channel_id != "" ? 1 : 0

  configuration_name = "${var.name_prefix}-alarm-notifications"
  iam_role_arn       = aws_iam_role.chatbot[0].arn
  slack_channel_id   = var.slack_channel_id
  slack_team_id      = var.slack_workspace_id
  sns_topic_arns     = [aws_sns_topic.alarms.arn]

  guardrail_policy_arns = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
  logging_level         = "ERROR"

  tags = var.tags
}
