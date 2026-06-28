# ─── Monitoring Environment Root ─────────────────────────────────────────────
# Manages the monitoring Lambda functions, IAM role, and read-only access
# policies for the monitoring dashboard.
#
# Applied by .github/workflows/cd-monitoring-deploy.yml — NOT the main CD.
# Completely isolated from the application infrastructure.
#
# State is stored in the MAIN project tfstate bucket (created by bootstrap)
# under key: monitoring/{environment}/terraform.tfstate — no separate bucket.
#
# Resources created:
#   1. IAM role for monitoring-api-service + monitoring-webapp (read-only AWS APIs)
#   2. IAM policies scoped to: CloudWatch, CloudWatch Logs, X-Ray, DynamoDB (audit table)
#   3. Lambda function: monitoring-api-service (NestJS + Lambda Web Adapter, port 8080)
#   4. Lambda function: monitoring-webapp (Next.js standalone + Lambda Web Adapter, port 3000)
#   5. Function URLs for both Lambdas (public HTTP access, auth handled by app)
#   6. CloudWatch log groups for both Lambdas
# ─────────────────────────────────────────────────────────────────────────────

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = "monitoring"
      ManagedBy   = "terraform"
    })
  }
}

locals {
  role_name = "${var.project_name}-monitoring-api"
}

# ─── Monitoring IAM Role ────────────────────────────────────────────────────
# Assumed by monitoring-api-service Lambda (and monitoring-webapp if deployed
# as Lambda) to read metrics, logs, traces, and audit log entries.
# Follows least-privilege: only the exact API calls the dashboard needs.

data "aws_iam_policy_document" "monitoring_assume_role" {
  statement {
    sid    = "AllowLambdaAssume"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "monitoring_api" {
  name               = local.role_name
  assume_role_policy = data.aws_iam_policy_document.monitoring_assume_role.json
}

# ─── CloudWatch Metrics Policy ──────────────────────────────────────────────
# Allows the monitoring API to fetch metric data for all dashboards.

data "aws_iam_policy_document" "cloudwatch_metrics" {
  statement {
    sid    = "ReadMetrics"
    effect = "Allow"

    actions = [
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:DescribeAlarmHistory",
      "cloudwatch:GetDashboard",
      "cloudwatch:ListDashboards",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "cloudwatch_metrics" {
  name        = "${local.role_name}-cloudwatch-metrics"
  description = "Allow monitoring API to read CloudWatch metrics and alarms"
  policy      = data.aws_iam_policy_document.cloudwatch_metrics.json
}

resource "aws_iam_role_policy_attachment" "cloudwatch_metrics" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = aws_iam_policy.cloudwatch_metrics.arn
}

# ─── CloudWatch Logs Policy ─────────────────────────────────────────────────
# Allows querying Lambda log groups. Scoped to the project's log groups.

data "aws_iam_policy_document" "cloudwatch_logs" {
  statement {
    sid    = "ReadLogs"
    effect = "Allow"

    actions = [
      "logs:FilterLogEvents",
      "logs:GetLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:StartQuery",
      "logs:StopQuery",
      "logs:GetQueryResults",
    ]

    # Scoped to log groups belonging to this project to limit blast radius.
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${var.project_name}-*",
      "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${var.project_name}-*:*",
    ]
  }
}

resource "aws_iam_policy" "cloudwatch_logs" {
  name        = "${local.role_name}-cloudwatch-logs"
  description = "Allow monitoring API to query CloudWatch Logs for Lambda functions"
  policy      = data.aws_iam_policy_document.cloudwatch_logs.json
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = aws_iam_policy.cloudwatch_logs.arn
}

# ─── X-Ray Policy ───────────────────────────────────────────────────────────
# Allows the monitoring API to fetch trace summaries and individual traces.

data "aws_iam_policy_document" "xray" {
  statement {
    sid    = "ReadTraces"
    effect = "Allow"

    actions = [
      "xray:GetTraceSummaries",
      "xray:BatchGetTraces",
      "xray:GetServiceGraph",
      "xray:GetTraceGraph",
      "xray:GetGroups",
      "xray:GetGroup",
      "xray:ListTagsForResource",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "xray" {
  name        = "${local.role_name}-xray"
  description = "Allow monitoring API to read X-Ray traces"
  policy      = data.aws_iam_policy_document.xray.json
}

resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = aws_iam_policy.xray.arn
}

# ─── Lambda Functions Policy ────────────────────────────────────────────────
# Allows the monitoring API to list, describe, and invoke project Lambda functions
# for the services dashboard (health checks, metadata, deployment verification).

data "aws_iam_policy_document" "lambda_functions" {
  statement {
    sid    = "ListFunctions"
    effect = "Allow"

    actions = [
      "lambda:ListFunctions",
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ReadAndInvokeFunctions"
    effect = "Allow"

    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:InvokeFunction",
      "lambda:ListVersionsByFunction",
      "lambda:GetFunctionConcurrency",
    ]

    # Scoped to project Lambda functions only
    resources = [
      "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${var.project_name}-*",
    ]
  }
}

resource "aws_iam_policy" "lambda_functions" {
  name        = "${local.role_name}-lambda-functions"
  description = "Allow monitoring API to list, describe, and invoke project Lambda functions"
  policy      = data.aws_iam_policy_document.lambda_functions.json
}

resource "aws_iam_role_policy_attachment" "lambda_functions" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = aws_iam_policy.lambda_functions.arn
}

# ─── SQS DLQ Monitoring Policy ─────────────────────────────────────────────
# Allows the monitoring API to read SQS queue attributes (DLQ depth, in-flight)
# for the services dashboard dead-letter queue health display.

data "aws_iam_policy_document" "sqs_monitoring" {
  statement {
    sid    = "ListQueues"
    effect = "Allow"

    actions = [
      "sqs:ListQueues",
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ReadQueueAttributes"
    effect = "Allow"

    actions = [
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]

    # Scoped to project queues only
    resources = [
      "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:${var.project_name}-*",
    ]
  }
}

resource "aws_iam_policy" "sqs_monitoring" {
  name        = "${local.role_name}-sqs-monitoring"
  description = "Allow monitoring API to read SQS queue attributes for DLQ monitoring"
  policy      = data.aws_iam_policy_document.sqs_monitoring.json
}

resource "aws_iam_role_policy_attachment" "sqs_monitoring" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = aws_iam_policy.sqs_monitoring.arn
}

# ─── Lambda Basic Execution ─────────────────────────────────────────────────
# Allows the monitoring Lambda to write its own logs.

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.monitoring_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ─── Lambda Web Adapter Layer ───────────────────────────────────────────────
# AWS-managed public layer that wraps an HTTP server as a Lambda function.
# https://github.com/aws/aws-lambda-web-adapter
# ARN format: arn:aws:lambda:{region}:753240598075:layer:LambdaAdapterLayerArm64:{version}

locals {
  lambda_web_adapter_layer_arn = "arn:aws:lambda:${var.aws_region}:753240598075:layer:LambdaAdapterLayerArm64:${var.lambda_web_adapter_version}"
  monitoring_api_name          = "${var.project_name}-${var.environment}-monitoring-api"
  monitoring_webapp_name       = "${var.project_name}-${var.environment}-monitoring-webapp"
}

# ─── Monitoring API Lambda ──────────────────────────────────────────────────
# NestJS service using Lambda Web Adapter on port 8080.
# Code is deployed separately by cd-monitoring-deploy.yml (update-function-code).

# Placeholder ZIP — replaced on first code deploy. Lambda requires code at creation.
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/.placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 503, body: 'Not yet deployed' });"
    filename = "index.js"
  }
}

# ─── JWT Secret for Monitoring Auth ─────────────────────────────────────────
# Auto-generated random secret for signing monitoring dashboard JWTs.
# Terraform manages the lifecycle — stable across deploys, rotated only if tainted.
resource "random_password" "monitoring_jwt_secret" {
  length  = 48
  special = false
}

resource "aws_lambda_function" "monitoring_api" {
  function_name = local.monitoring_api_name
  role          = aws_iam_role.monitoring_api.arn
  handler       = "run.sh"  # Lambda Web Adapter entrypoint
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  memory_size   = var.monitoring_api_memory
  timeout       = var.monitoring_api_timeout

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  layers = [local.lambda_web_adapter_layer_arn]

  environment {
    variables = merge(
      {
        AWS_LAMBDA_EXEC_WRAPPER    = "/opt/bootstrap"
        PORT                       = "8080"
        MONITORING_API_PORT        = "8080"
        NODE_ENV                   = "production"
        MONITORING_JWT_SECRET      = random_password.monitoring_jwt_secret.result
        TARGET_ENVIRONMENT         = var.environment
        PROJECT_NAME               = var.project_name
        AWS_ACCOUNT_ID             = var.aws_account_id
      },
      var.monitoring_api_env_vars,
    )
  }

  # Ignore code changes — CD workflow manages code via update-function-code.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function_url" "monitoring_api" {
  function_name      = aws_lambda_function.monitoring_api.function_name
  authorization_type = "NONE" # App handles JWT auth internally
}

resource "aws_lambda_permission" "monitoring_api_url" {
  statement_id           = "AllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.monitoring_api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_cloudwatch_log_group" "monitoring_api" {
  name              = "/aws/lambda/${local.monitoring_api_name}"
  retention_in_days = 14
}

# ─── Monitoring Webapp Lambda ───────────────────────────────────────────────
# Next.js standalone server using Lambda Web Adapter on port 3000.
# Deployed as a container image — same approach as the main webapp.
# Code is deployed separately by cd-monitoring-deploy.yml (update-function-code --image-uri).

resource "aws_iam_role_policy" "monitoring_ecr_pull" {
  name = "ecr-pull"
  role = aws_iam_role.monitoring_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      }
    ]
  })
}

resource "time_sleep" "monitoring_iam_propagation" {
  depends_on      = [aws_iam_role_policy.monitoring_ecr_pull]
  create_duration = "10s"
}

resource "aws_lambda_function" "monitoring_webapp" {
  function_name = local.monitoring_webapp_name
  role          = aws_iam_role.monitoring_api.arn
  package_type  = "Image"
  architectures = ["arm64"]
  memory_size   = var.monitoring_webapp_memory
  timeout       = var.monitoring_webapp_timeout

  image_uri = "${var.monitoring_ecr_repo_url}:${var.monitoring_webapp_image_tag}"

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/extensions/lambda-adapter"
      PORT                    = "3000"
      NODE_ENV                = "production"
    }
  }

  # Ignore image changes — CD workflow manages code via update-function-code.
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.monitoring_webapp,
    time_sleep.monitoring_iam_propagation
  ]
}

resource "aws_lambda_function_url" "monitoring_webapp" {
  function_name      = aws_lambda_function.monitoring_webapp.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "monitoring_webapp_url" {
  statement_id           = "AllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.monitoring_webapp.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_cloudwatch_log_group" "monitoring_webapp" {
  name              = "/aws/lambda/${local.monitoring_webapp_name}"
  retention_in_days = 14
}
