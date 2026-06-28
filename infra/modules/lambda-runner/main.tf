# ─── Lambda Runner Module ─────────────────────────────────────────────────────
# Runs one-shot deployment initialization tasks (Prisma migrations, seed scripts,
# custom scripts) via an AWS Lambda function invoked during CD after Terraform apply.
#
# Replaces the ECS Fargate init-runner — same logic, no Docker image, no ECS cluster.
# The Lambda is packaged as a ZIP (uploaded to S3 by the CD workflow) and invoked
# synchronously via `aws lambda invoke --invocation-type RequestResponse`.
#
# VPC config is optional — non-Prisma tasks (seed scripts, DynamoDB seeds) work
# without VPC access. Prisma-migrate tasks need VPC to reach RDS; pass subnet_ids
# and security_group_ids from the networking module when requires_vpc is true.

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
  name = "${var.project_name}-${var.environment}-init-runner"

  # Collect all unique env var keys referenced by deploy tasks
  all_task_env_vars = distinct(flatten([
    for task in var.deploy_tasks : try(task.envVars, [])
  ]))

  # Collect all secret env var keys for the SECRETS_ALLOW_LIST
  all_secret_env_vars = distinct(flatten([
    for task in var.deploy_tasks : try(task.secretEnvVars, [])
  ]))

  # Build Lambda environment variables
  lambda_env_vars = merge(
    {
      INIT_TASKS          = jsonencode(var.deploy_tasks)
      AWS_SECRETS_ARN     = var.aws_secrets_arn
      SECRETS_ALLOW_LIST  = join(",", local.all_secret_env_vars)
    },
    {
      for key in local.all_task_env_vars :
      key => lookup(var.resolved_env_vars, key, "")
      if key != "AWS_SECRETS_ARN"
    }
  )
}

# ─── CloudWatch Log Group ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "runner" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ─── IAM — Execution Role ────────────────────────────────────────────────────

resource "aws_iam_role" "runner" {
  name = "${local.name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.runner.arn}:*"
    }]
  })
}

# VPC access (enables ENI creation for private-subnet Lambda)
resource "aws_iam_role_policy_attachment" "vpc_access" {
  count      = length(var.subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.runner.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "secrets" {
  count = var.enable_secrets ? 1 : 0
  name  = "secrets-access"
  role  = aws_iam_role.runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.aws_secrets_arn]
    }]
  })
}

resource "aws_iam_role_policy" "dynamodb" {
  count = length(var.dynamodb_table_arns) > 0 ? 1 : 0
  name  = "dynamodb-access"
  role  = aws_iam_role.runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query",
        "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"
      ]
      Resource = concat(
        var.dynamodb_table_arns,
        [for arn in var.dynamodb_table_arns : "${arn}/index/*"]
      )
    }]
  })
}

resource "aws_iam_role_policy" "cognito" {
  count = length(var.cognito_user_pool_arns) > 0 ? 1 : 0
  name  = "cognito-access"
  role  = aws_iam_role.runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminGetUser"
      ]
      Resource = var.cognito_user_pool_arns
    }]
  })
}

# ─── Lambda Function ─────────────────────────────────────────────────────────

resource "aws_lambda_function" "runner" {
  function_name = local.name
  role          = aws_iam_role.runner.arn

  # Deployed via S3 ZIP — uploaded by CD workflow before invoke
  s3_bucket = var.s3_bucket
  s3_key    = var.s3_key

  handler       = "handler.handler"
  runtime       = "nodejs24.x"
  architectures = ["arm64"]

  # 15 min max — enough for any Prisma migration or seed script
  timeout     = 900
  memory_size = 512

  environment {
    variables = local.lambda_env_vars
  }

  dynamic "vpc_config" {
    for_each = length(var.subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.runner,
    aws_iam_role_policy.logs,
  ]

  tags = var.tags
}
