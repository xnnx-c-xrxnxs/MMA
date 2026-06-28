# ─── Monitoring Module ───────────────────────────────────────────────────────
# Creates CloudWatch alarms and dashboards for all service types.
# Alarms and dashboards are both gated by their own enable vars so they
# can be toggled independently. Disable both for preview environments.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

# ─── Lambda Error Alarms ────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.enable_alarms ? var.lambda_functions : {}

  alarm_name          = "${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  alarm_description   = "Lambda ${each.value} error count exceeded threshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    FunctionName = each.value
  }

  tags = var.tags
}

# ─── Lambda Throttle Alarms ─────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = var.enable_alarms ? var.lambda_functions : {}

  alarm_name          = "${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.lambda_throttle_threshold
  alarm_description   = "Lambda ${each.value} is being throttled"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    FunctionName = each.value
  }

  tags = var.tags
}

# ─── SQS DLQ Alarms ────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  for_each = var.enable_alarms ? var.dlq_arns : {}

  alarm_name          = "${var.name_prefix}-${each.key}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Dead letter queue ${each.key} has messages"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    QueueName = each.value
  }

  tags = var.tags
}

# ─── DynamoDB Throttle Alarms ───────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  for_each = var.enable_alarms ? var.dynamodb_tables : {}

  alarm_name          = "${var.name_prefix}-${each.key}-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.dynamodb_throttle_threshold
  alarm_description   = "DynamoDB table ${each.value} is being throttled"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    TableName = each.value
  }

  tags = var.tags
}

# ─── RDS High Connections Alarm ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  for_each = var.enable_alarms ? var.rds_instances : {}

  alarm_name          = "${var.name_prefix}-${each.key}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_connections_threshold
  alarm_description   = "RDS instance ${each.value} has high connection count"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = each.value
  }

  tags = var.tags
}

# ─── API Gateway 5XX Alarm ──────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  count = var.enable_alarms && var.enable_api_gateway_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-gateway-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = var.api_gateway_5xx_threshold
  alarm_description   = "API Gateway ${var.api_gateway_id} 5XX error rate exceeded threshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ApiId = var.api_gateway_id
  }

  tags = var.tags
}

# ─── Dashboard: Services Overview ───────────────────────────────────────────
# One row per Lambda: invocations + errors + duration (p50/p95/p99) + throttles

locals {
  dashboard_enabled = var.enable_dashboards && length(var.lambda_functions) > 0

  # Build the widget list for the services dashboard dynamically.
  # Each function gets a 2-column row: error+throttle | duration percentiles.
  services_widgets = flatten([
    for idx, fn_name in values(var.lambda_functions) : [
      {
        type   = "metric"
        x      = 0
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${fn_name} — Errors & Throttles"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", fn_name, { color = "#d62728" }],
            ["AWS/Lambda", "Throttles", "FunctionName", fn_name, { color = "#ff7f0e" }],
            ["AWS/Lambda", "Invocations", "FunctionName", fn_name, { color = "#1f77b4", yAxis = "right" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${fn_name} — Duration (ms)"
          region = var.aws_region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", fn_name, { stat = "p50", label = "p50" }],
            ["AWS/Lambda", "Duration", "FunctionName", fn_name, { stat = "p95", label = "p95" }],
            ["AWS/Lambda", "Duration", "FunctionName", fn_name, { stat = "p99", label = "p99", color = "#d62728" }],
          ]
        }
      }
    ]
  ])

  sqs_widgets = flatten([
    for idx, q_name in values(var.sqs_queues) : [
      {
        type   = "metric"
        x      = 0
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${q_name} — Messages"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/SQS", "NumberOfMessagesSent", "QueueName", q_name, { color = "#1f77b4" }],
            ["AWS/SQS", "NumberOfMessagesDeleted", "QueueName", q_name, { color = "#2ca02c" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesNotVisible", "QueueName", q_name, { color = "#ff7f0e" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${q_name} DLQ — Depth"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Maximum"
          period = 300
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${q_name}-dlq", { color = "#d62728" }],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", "${q_name}-dlq", { color = "#9467bd", yAxis = "right" }],
          ]
        }
      }
    ]
  ])

  dynamodb_widgets = flatten([
    for idx, tbl_name in values(var.dynamodb_tables) : [
      {
        type   = "metric"
        x      = 0
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${tbl_name} — Capacity"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", tbl_name, { color = "#1f77b4" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", tbl_name, { color = "#ff7f0e" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = idx * 6
        width  = 12
        height = 6
        properties = {
          title  = "${tbl_name} — Errors & Throttles"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", tbl_name, { color = "#d62728" }],
            ["AWS/DynamoDB", "SystemErrors", "TableName", tbl_name, { color = "#9467bd" }],
            ["AWS/DynamoDB", "UserErrors", "TableName", tbl_name, { color = "#ff7f0e" }],
          ]
        }
      }
    ]
  ])

  rds_widgets = flatten([
    for idx, db_id in values(var.rds_instances) : [
      {
        type   = "metric"
        x      = 0
        y      = idx * 6
        width  = 8
        height = 6
        properties = {
          title  = "${db_id} — Connections"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", db_id, { color = "#1f77b4" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = idx * 6
        width  = 8
        height = 6
        properties = {
          title  = "${db_id} — Latency (ms)"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/RDS", "CommitLatency", "DBInstanceIdentifier", db_id, { color = "#2ca02c" }],
            ["AWS/RDS", "ReadLatency", "DBInstanceIdentifier", db_id, { color = "#1f77b4" }],
            ["AWS/RDS", "WriteLatency", "DBInstanceIdentifier", db_id, { color = "#ff7f0e" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = idx * 6
        width  = 8
        height = 6
        properties = {
          title  = "${db_id} — Memory & CPU"
          region = var.aws_region
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", db_id, { color = "#2ca02c" }],
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", db_id, { color = "#d62728", yAxis = "right" }],
          ]
        }
      }
    ]
  ])

  api_gw_widgets = [
    {
      type   = "metric"
      x      = 0
      y      = 0
      width  = 8
      height = 6
      properties = {
        title  = "API Gateway — Request Count"
        region = var.aws_region
        view   = "timeSeries"
        stat   = "Sum"
        period = 300
        metrics = [
          ["AWS/ApiGateway", "Count", "ApiId", var.api_gateway_id, { color = "#1f77b4" }],
        ]
      }
    },
    {
      type   = "metric"
      x      = 8
      y      = 0
      width  = 8
      height = 6
      properties = {
        title  = "API Gateway — Error Rates"
        region = var.aws_region
        view   = "timeSeries"
        stat   = "Sum"
        period = 300
        metrics = [
          ["AWS/ApiGateway", "4xx", "ApiId", var.api_gateway_id, { color = "#ff7f0e" }],
          ["AWS/ApiGateway", "5xx", "ApiId", var.api_gateway_id, { color = "#d62728" }],
        ]
      }
    },
    {
      type   = "metric"
      x      = 16
      y      = 0
      width  = 8
      height = 6
      properties = {
        title  = "API Gateway — Latency (ms)"
        region = var.aws_region
        view   = "timeSeries"
        period = 300
        metrics = [
          ["AWS/ApiGateway", "Latency", "ApiId", var.api_gateway_id, { stat = "p50", label = "p50" }],
          ["AWS/ApiGateway", "Latency", "ApiId", var.api_gateway_id, { stat = "p95", label = "p95" }],
          ["AWS/ApiGateway", "IntegrationLatency", "ApiId", var.api_gateway_id, { stat = "p95", label = "integration p95", color = "#ff7f0e" }],
        ]
      }
    }
  ]
}

resource "aws_cloudwatch_dashboard" "services" {
  count          = local.dashboard_enabled ? 1 : 0
  dashboard_name = "${var.name_prefix}-services"

  dashboard_body = jsonencode({
    widgets = local.services_widgets
  })
}

resource "aws_cloudwatch_dashboard" "sqs" {
  count          = var.enable_dashboards && length(var.sqs_queues) > 0 ? 1 : 0
  dashboard_name = "${var.name_prefix}-sqs"

  dashboard_body = jsonencode({
    widgets = local.sqs_widgets
  })
}

resource "aws_cloudwatch_dashboard" "dynamodb" {
  count          = var.enable_dashboards && length(var.dynamodb_tables) > 0 ? 1 : 0
  dashboard_name = "${var.name_prefix}-dynamodb"

  dashboard_body = jsonencode({
    widgets = local.dynamodb_widgets
  })
}

resource "aws_cloudwatch_dashboard" "rds" {
  count          = var.enable_dashboards && length(var.rds_instances) > 0 ? 1 : 0
  dashboard_name = "${var.name_prefix}-rds"

  dashboard_body = jsonencode({
    widgets = local.rds_widgets
  })
}

resource "aws_cloudwatch_dashboard" "api_gateway" {
  count          = var.enable_dashboards && var.enable_api_gateway_monitoring ? 1 : 0
  dashboard_name = "${var.name_prefix}-api-gateway"

  dashboard_body = jsonencode({
    widgets = local.api_gw_widgets
  })
}
