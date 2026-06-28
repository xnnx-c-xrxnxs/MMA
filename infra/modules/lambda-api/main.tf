# ─── Lambda API Module ───────────────────────────────────────────────────────
# Creates a Lambda function from S3 ZIP + API Gateway HTTP API v2.
# Called via for_each — one invocation per registry apiService.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  function_name = replace(substr("${var.project_name}-${var.environment}-${var.service_name}", 0, 59), "/-+$/", "")
  log_group     = "/aws/lambda/${local.function_name}"

  # ADOT layer — swap amd64/arm64 in the layer name to match the Lambda architecture
  adot_layer_name = var.architecture == "arm64" ? replace(var.adot_layer_id, "amd64", "arm64") : replace(var.adot_layer_id, "arm64", "amd64")
  adot_layer_arn  = var.adot_layer_id != "" ? "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:${local.adot_layer_name}" : ""

  # Lambda Web Adapter — AWS-managed layer that runs the NestJS HTTP server
  # inside Lambda, translating invocation events to HTTP requests.
  # https://github.com/aws/aws-lambda-web-adapter
  lwa_layer_name               = var.architecture == "arm64" ? "LambdaAdapterLayerArm64" : "LambdaAdapterLayerX86"
  lambda_web_adapter_layer_arn = "arn:aws:lambda:${data.aws_region.current.id}:753240598075:layer:${local.lwa_layer_name}:${var.lambda_web_adapter_version}"
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

# Base execution policy (CloudWatch Logs)
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

# DynamoDB policy (conditional — if any DYNAMODB env var is present)
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

# SQS publish policy (conditional)
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

# S3 runtime access policy (conditional — for services that read/write S3 buckets)
resource "aws_iam_role_policy" "s3_access" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0
  name  = "s3-access"
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

# Cognito policy (conditional — for services that use AdminInitiateAuth, AdminCreateUser, etc.)
resource "aws_iam_role_policy" "cognito" {
  count = length(var.cognito_user_pool_arns) > 0 ? 1 : 0
  name  = "cognito-access"
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

  # Lambda Web Adapter layer (always attached) + optional ADOT layer for X-Ray
  layers = compact([
    local.lambda_web_adapter_layer_arn,
    local.adot_layer_arn != "" ? local.adot_layer_arn : "",
  ])

  tracing_config {
    mode = local.adot_layer_arn != "" ? "Active" : "PassThrough"
  }

  environment {
    # AWS_LAMBDA_EXEC_WRAPPER = /opt/bootstrap activates the Web Adapter.
    # AWS_LWA_REMOVE_BASE_PATH strips the /{domain} prefix added by API Gateway
    # path-based routing, so NestJS only sees /api/{resource}.
    # ADOT (when enabled) uses env-var-only config (OTEL_*) instead of the
    # wrapper approach, since the Web Adapter occupies the wrapper slot.
    variables = merge(var.environment_variables, {
      AWS_LAMBDA_EXEC_WRAPPER  = "/opt/bootstrap"
      AWS_LWA_REMOVE_BASE_PATH = "/${var.domain}"
      PORT                     = tostring(var.service_port)
    })
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

# ─── API Gateway Integration ────────────────────────────────────────────────
# The HTTP API + stage are created by the shared api-gateway module.
# This module wires the Lambda function to a path-based route: /{domain}/{proxy+}

resource "aws_apigatewayv2_integration" "this" {
  api_id                 = var.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = var.api_id
  route_key = "ANY /${var.domain}/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.this.id}"

  # When a JWT authorizer is wired in, every request to the catch-all route
  # must carry a valid Bearer token. Public routes (sign-in, /health, /docs)
  # are declared as separate routes below with authorization_type = "NONE",
  # which always wins because per-route auth on a more-specific route key
  # overrides the catch-all.
  authorization_type = var.jwt_authorizer_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.jwt_authorizer_id != "" ? var.jwt_authorizer_id : null
}

# CORS preflight — OPTIONS requests must bypass the JWT authorizer so NestJS
# can respond with the correct Access-Control-Allow-* headers. Browsers send
# OPTIONS without an Authorization header; the JWT authorizer would reject
# with 401 before Lambda is invoked, breaking all cross-origin requests.
# The more-specific "OPTIONS" route wins over the "ANY" catch-all.
resource "aws_apigatewayv2_route" "options" {
  count              = var.enable_cors_route ? 1 : 0
  api_id             = var.api_id
  route_key          = "OPTIONS /${var.domain}/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.this.id}"
  authorization_type = "NONE"
}

# Public routes — bypass the JWT authorizer. These are the SAME routes that
# carry @Public() decorators in the NestJS service. Counts and paths must
# match — enforced by the gateway-public-routes-sync structural lint check.
resource "aws_apigatewayv2_route" "public" {
  for_each = { for r in var.public_routes : "${r.method} ${r.path}" => r }

  api_id             = var.api_id
  route_key          = "${each.value.method} /${var.domain}${each.value.path}"
  target             = "integrations/${aws_apigatewayv2_integration.this.id}"
  authorization_type = "NONE"
}

# ─── Lambda Permission for API Gateway ──────────────────────────────────────

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
