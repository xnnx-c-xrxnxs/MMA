# ─── Lambda Webapp Module ────────────────────────────────────────────────────
# Deploys a Next.js standalone app as a Lambda container image.
# Uses the same Docker image as ECS (Lambda Web Adapter is baked in).
# Alternative to the ECS webapp module — cheaper for dev/preview environments.
# Uses Function URL for public HTTP access (no ALB, no ECS cluster).

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }
}

data "aws_region" "current" {}

locals {
  function_name = replace(substr("${var.project_name}-${var.environment}-webapp", 0, 59), "/-+$/", "")
  log_group     = "/aws/lambda/${local.function_name}"
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
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.this.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecr_pull" {
  name = "ecr-pull"
  role = aws_iam_role.lambda.id

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

# ─── IAM Propagation Delay ──────────────────────────────────────────────────
# IAM is eventually consistent. A newly-created ECR pull policy may not be
# visible to Lambda for several seconds, causing "AccessDeniedException: Lambda
# does not have permission to access the ECR image." Adding a short sleep
# ensures the policy has propagated before Lambda tries to pull the image.

resource "time_sleep" "iam_propagation" {
  depends_on      = [aws_iam_role_policy.ecr_pull]
  create_duration = "10s"
}

# ─── Lambda Function (Container Image) ──────────────────────────────────────

resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  architectures = [var.architecture]
  memory_size   = var.memory_size
  timeout       = var.timeout

  image_uri = var.image_uri

  environment {
    variables = merge(var.environment_variables, {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/extensions/lambda-adapter"
      PORT                    = tostring(var.container_port)
      NODE_ENV                = "production"
    })
  }

  # Ignore image changes — CD workflow manages code via update-function-code.
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy.lambda_logs,
    time_sleep.iam_propagation
  ]

  tags = merge(var.tags, {
    Service = "webapp"
  })
}

# ─── Function URL (public HTTP access) ──────────────────────────────────────

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "function_url" {
  statement_id           = "AllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
