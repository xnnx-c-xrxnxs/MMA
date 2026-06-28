# ─── Lambda Worker Module ────────────────────────────────────────────────────
# Creates a Lambda function + SQS event source mapping (no API Gateway).
# Called via for_each — one invocation per registry eventHandlerService.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

data "aws_region" "current" {}

locals {
  function_name  = replace(substr("${var.project_name}-${var.environment}-${var.service_name}", 0, 59), "/-+$/", "")
  log_group      = "/aws/lambda/${local.function_name}"
  # ADOT layer — swap amd64/arm64 in the layer name to match the Lambda architecture
  adot_layer_name = var.architecture == "arm64" ? replace(var.adot_layer_id, "amd64", "arm64") : replace(var.adot_layer_id, "arm64", "amd64")
  adot_layer_arn  = var.adot_layer_id != "" ? "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:${local.adot_layer_name}" : ""
}

# ─── CloudWatch Log Group ───────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "this" {
  name              = local.log_group
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# ─── IAM Execution Role ─────────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  name = "${local.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "lambda_base" {
  name = "base-execution"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.this.arn}:*"
      }
    ]
  })
}

# SQS consume policy (always needed for workers)
resource "aws_iam_role_policy" "sqs_consume" {
  name = "sqs-consume"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = var.sqs_queue_arn
      }
    ]
  })
}

# X-Ray tracing policy (always attached — enables PutTraceSegments for ADOT + active tracing)
resource "aws_iam_role_policy" "xray" {
  name = "xray-tracing"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# VPC access policy (conditional)

# DynamoDB policy (conditional)
resource "aws_iam_role_policy" "dynamodb" {
  count = length(var.dynamodb_table_arns) > 0 ? 1 : 0
  name  = "dynamodb-access"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = flatten([
          for arn in var.dynamodb_table_arns : [
            arn,
            "${arn}/index/*"
          ]
        ])
      }
    ]
  })
}

# SQS publish policy (conditional — for saga participants that publish to other queues)
resource "aws_iam_role_policy" "sqs_publish" {
  count = length(var.sqs_publish_arns) > 0 ? 1 : 0
  name  = "sqs-publish"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:GetQueueUrl"]
        Resource = var.sqs_publish_arns
      }
    ]
  })
}

# Secrets Manager policy (conditional)
resource "aws_iam_role_policy" "secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0
  name  = "secrets-access"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.secret_arns
      }
    ]
  })
}

# S3 runtime access policy (conditional)
resource "aws_iam_role_policy" "s3_access" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0
  name  = "s3-runtime-access"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = flatten([
          for arn in var.s3_bucket_arns : [
            arn,
            "${arn}/*"
          ]
        ])
      }
    ]
  })
}

# Cognito admin policy (conditional)
resource "aws_iam_role_policy" "cognito" {
  count = length(var.cognito_user_pool_arns) > 0 ? 1 : 0
  name  = "cognito-admin-access"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:ForgotPassword",
          "cognito-idp:ConfirmForgotPassword",
          "cognito-idp:ChangePassword",
          "cognito-idp:GlobalSignOut"
        ]
        Resource = var.cognito_user_pool_arns
      }
    ]
  })
}

# ─── Lambda Function ────────────────────────────────────────────────────────

resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  handler       = var.handler
  runtime       = var.runtime
  architectures = [var.architecture]
  memory_size   = var.memory_size
  timeout       = var.timeout

  s3_bucket = var.s3_bucket
  s3_key    = var.s3_key

  # Attach ADOT layer when a version is provided
  layers = local.adot_layer_arn != "" ? [local.adot_layer_arn] : []

  tracing_config {
    mode = local.adot_layer_arn != "" ? "Active" : "PassThrough"
  }

  environment {
    variables = local.adot_layer_arn != "" ? merge(var.environment_variables, {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/otel-handler"
    }) : var.environment_variables
  }

  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy.lambda_base
  ]

  tags = merge(var.tags, {
    Service = var.service_name
  })
}

# ─── SQS Event Source Mapping ───────────────────────────────────────────────

resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn = var.sqs_queue_arn
  function_name    = aws_lambda_function.this.arn
  batch_size       = var.batch_size
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]
}
