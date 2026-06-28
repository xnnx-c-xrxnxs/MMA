# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap — One-Time Per-Account Setup
#
# Creates the foundation resources needed before any environment can be deployed:
#   1. S3 bucket for Terraform remote state (versioned, encrypted)
#   2. DynamoDB table for state locking
#   3. GitHub OIDC identity provider
#   4. IAM deploy role (trusted by GitHub Actions via OIDC)
#   5. S3 bucket for Lambda deployment artifacts
#   6. ECR repository for webapp Docker images
#
# Usage:
#   cd infra/bootstrap
#   terraform init
#   terraform apply -var="project_name=acme" -var="github_org=MyOrg" -var="github_repo=my-repo"
#
# This must be run ONCE per AWS account by a developer with admin access.
# After running, all subsequent infrastructure is managed by GitHub Actions.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }

  # Bootstrap uses LOCAL state — it creates the remote backend for everything else.
  # The state file is small and committed/stored safely by the person who runs it.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project   = var.project_name
      ManagedBy = "terraform-bootstrap"
    })
  }
}

locals {
  # When `environment` is set, suffix globally-unique names (S3 buckets) to allow
  # one bootstrap per AWS account in a multi-account setup.
  # ECR repo + IAM role names are account-scoped and do NOT need suffixing.
  name_suffix          = var.environment != "" ? "${var.project_name}-${var.environment}" : var.project_name
  state_bucket_name    = "${local.name_suffix}-tfstate"
  lock_table_name      = "${local.name_suffix}-tflock"
  artifact_bucket_name = "${local.name_suffix}-deploy-artifacts"
  ecr_repo_name             = "${var.project_name}-webapp"
  monitoring_ecr_repo_name  = "${var.project_name}-monitoring-webapp"
  deploy_role_name     = "${var.project_name}-deploy"
  oidc_provider_url    = "token.actions.githubusercontent.com"
}

# ─── Terraform State Bucket ──────────────────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = local.state_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Terraform Lock Table ────────────────────────────────────────────────────

resource "aws_dynamodb_table" "tflock" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# ─── Lambda Deployment Artifact Bucket ───────────────────────────────────────

resource "aws_s3_bucket" "artifacts" {
  bucket = local.artifact_bucket_name
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"

    filter {}

    # Keep artifacts for 90 days — allows rollback to any recent deploy
    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ─── ECR Repository (webapp Docker images) ──────────────────────────────────

resource "aws_ecr_repository" "webapp" {
  name                 = local.ecr_repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "webapp" {
  repository = aws_ecr_repository.webapp.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 50 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Allow Lambda service to pull images from this ECR repo.
# Required for package_type = "Image" Lambda functions.
resource "aws_ecr_repository_policy" "lambda_access" {
  repository = aws_ecr_repository.webapp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "LambdaECRImageRetrievalPolicy"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
      }
    ]
  })
}

# ─── ECR Repository (monitoring-webapp Docker images) ────────────────────────

resource "aws_ecr_repository" "monitoring_webapp" {
  name                 = local.monitoring_ecr_repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "monitoring_webapp" {
  repository = aws_ecr_repository.monitoring_webapp.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 20 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_repository_policy" "monitoring_lambda_access" {
  repository = aws_ecr_repository.monitoring_webapp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "LambdaECRImageRetrievalPolicy"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
      }
    ]
  })
}

# ─── GitHub OIDC Provider ────────────────────────────────────────────────────

data "aws_iam_openid_connect_provider" "github_existing" {
  count = 0 # Will be used in the check below
  url   = "https://${local.oidc_provider_url}"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://${local.oidc_provider_url}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]
}

# ─── IAM Deploy Role ────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "deploy" {
  name = local.deploy_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "${local.oidc_provider_url}:sub" = "repo:${var.github_org}/${var.github_repo}:*"
          }
          StringEquals = {
            "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  max_session_duration = 7200 # 2 hours — enough for long deployments
}

# ─── IAM Deploy Policy ──────────────────────────────────────────────────────
# Scoped to the resources this project creates. Uses project_name prefix.

resource "aws_iam_role_policy" "deploy" {
  name = "${var.project_name}-deploy-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Lambda — full control on project-prefixed functions
      {
        Effect = "Allow"
        Action = [
          "lambda:*"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*"
      },
      # Lambda — read AWS-published layers (ADOT from 901920570463, Lambda Web Adapter from 753240598075).
      # Required so Terraform can attach public Lambda layers that live in AWS's own account.
      {
        Effect = "Allow"
        Action = [
          "lambda:GetLayerVersion"
        ]
        Resource = [
          "arn:aws:lambda:*:901920570463:layer:*",
          "arn:aws:lambda:*:753240598075:layer:*"
        ]
      },
      # Lambda — list/describe (needed for planning) + event source mapping CRUD
      {
        Effect = "Allow"
        Action = [
          "lambda:ListFunctions",
          "lambda:GetAccountSettings",
          "lambda:ListEventSourceMappings",
          "lambda:CreateEventSourceMapping",
          "lambda:GetEventSourceMapping",
          "lambda:UpdateEventSourceMapping",
          "lambda:DeleteEventSourceMapping",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags"
        ]
        Resource = "*"
      },
      # API Gateway
      {
        Effect = "Allow"
        Action = [
          "apigateway:*"
        ]
        Resource = [
          "arn:aws:apigateway:${var.aws_region}::/*"
        ]
      },
      # DynamoDB — project-prefixed tables
      {
        Effect = "Allow"
        Action = [
          "dynamodb:*"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.project_name}-*"
        ]
      },
      # DynamoDB — list/describe (planning)
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:ListTables",
          "dynamodb:DescribeReservedCapacity",
          "dynamodb:DescribeLimits",
          "dynamodb:ListTagsOfResource"
        ]
        Resource = "*"
      },
      # SQS — project-prefixed queues
      {
        Effect = "Allow"
        Action = [
          "sqs:*"
        ]
        Resource = "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.project_name}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ListQueues"]
        Resource = "*"
      },
      # S3 — artifact bucket + project-prefixed buckets
      {
        Effect = "Allow"
        Action = [
          "s3:*"
        ]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*",
          "arn:aws:s3:::${var.project_name}-*",
          "arn:aws:s3:::${var.project_name}-*/*"
        ]
      },
      # CloudFront — distributions, OAC, public keys, key groups (for webapp CDN + S3 signed downloads)
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateDistribution",
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:TagResource",
          "cloudfront:UntagResource",
          "cloudfront:ListTagsForResource",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:UpdateOriginAccessControl",
          "cloudfront:DeleteOriginAccessControl",
          "cloudfront:GetOriginAccessControl",
          "cloudfront:ListOriginAccessControls",
          "cloudfront:CreatePublicKey",
          "cloudfront:UpdatePublicKey",
          "cloudfront:DeletePublicKey",
          "cloudfront:GetPublicKey",
          "cloudfront:ListPublicKeys",
          "cloudfront:CreateKeyGroup",
          "cloudfront:UpdateKeyGroup",
          "cloudfront:DeleteKeyGroup",
          "cloudfront:GetKeyGroup",
          "cloudfront:ListKeyGroups",
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations",
          "cloudfront:CreateResponseHeadersPolicy",
          "cloudfront:UpdateResponseHeadersPolicy",
          "cloudfront:DeleteResponseHeadersPolicy",
          "cloudfront:GetResponseHeadersPolicy",
          "cloudfront:ListResponseHeadersPolicies"
        ]
        Resource = "*"
      },
      # ECR — push/pull webapp images
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = aws_ecr_repository.webapp.arn
      },
      # ECS — project-prefixed clusters/services
      {
        Effect = "Allow"
        Action = [
          "ecs:*"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.project_name}-*",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${var.project_name}-*/*",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/${var.project_name}-*/*",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${var.project_name}-*:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:ListClusters",
          "ecs:ListServices",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:ListTaskDefinitions"
        ]
        Resource = "*"
      },
      # CloudWatch Logs — all project log groups (Lambda, ECS, API Gateway)
      {
        Effect = "Allow"
        Action = [
          "logs:*"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*:*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${var.project_name}-*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${var.project_name}-*:*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/apigateway/${var.project_name}-*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/apigateway/${var.project_name}-*:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DescribeLogGroups",
          "logs:ListTagsLogGroup",
          "logs:ListTagsForResource",
          "logs:TagResource",
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies"
        ]
        Resource = "*"
      },
      # Secrets Manager
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:*"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}-*"
      },
      # Cognito — pool-level operations (resource-scoped)
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:*"
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/*"
      },
      # Cognito — service-level operations (CreateUserPool does not support resource ARNs)
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:CreateUserPool",
          "cognito-idp:ListUserPools",
          "cognito-idp:DescribeUserPool"
        ]
        Resource = "*"
      },
      # RDS
      {
        Effect = "Allow"
        Action = [
          "rds:*"
        ]
        Resource = [
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.project_name}-*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster-snapshot:${var.project_name}-*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:snapshot:${var.project_name}-*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:${var.project_name}-*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:subgrp:${var.project_name}-*",
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster-pg:*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["rds:DescribeDBClusters", "rds:DescribeDBInstances", "rds:DescribeDBSubnetGroups", "rds:DescribeDBClusterParameterGroups", "rds:DescribeOrderableDBInstanceOptions", "rds:DescribeGlobalClusters"]
        Resource = "*"
      },
      # Service-linked role for RDS (required on first RDS instance creation)
      {
        Effect = "Allow"
        Action = [
          "iam:CreateServiceLinkedRole"
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/rds.amazonaws.com/AWSServiceRoleForRDS"
        Condition = {
          StringLike = {
            "iam:AWSServiceName" = "rds.amazonaws.com"
          }
        }
      },
      # Service-linked role for Application Auto Scaling (required on first ECS autoscaling target creation)
      {
        Effect = "Allow"
        Action = [
          "iam:CreateServiceLinkedRole"
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService"
        Condition = {
          StringLike = {
            "iam:AWSServiceName" = "ecs.application-autoscaling.amazonaws.com"
          }
        }
      },
      # Service-linked role for AWS Chatbot (required on first Slack channel configuration)
      {
        Effect = "Allow"
        Action = [
          "iam:CreateServiceLinkedRole"
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/management.chatbot.amazonaws.com/AWSServiceRoleForAWSChatbot"
        Condition = {
          StringLike = {
            "iam:AWSServiceName" = "management.chatbot.amazonaws.com"
          }
        }
      },
      # VPC — project-prefixed resources created by Terraform
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateVpc", "ec2:DeleteVpc", "ec2:ModifyVpcAttribute", "ec2:DescribeVpcs",
          "ec2:CreateSubnet", "ec2:DeleteSubnet", "ec2:DescribeSubnets", "ec2:ModifySubnetAttribute",
          "ec2:CreateInternetGateway", "ec2:DeleteInternetGateway", "ec2:AttachInternetGateway", "ec2:DetachInternetGateway", "ec2:DescribeInternetGateways",
          "ec2:CreateNatGateway", "ec2:DeleteNatGateway", "ec2:DescribeNatGateways",
          "ec2:AllocateAddress", "ec2:ReleaseAddress", "ec2:DescribeAddresses", "ec2:DescribeAddressesAttribute", "ec2:DisassociateAddress",
          "ec2:CreateRouteTable", "ec2:DeleteRouteTable", "ec2:CreateRoute", "ec2:DeleteRoute", "ec2:AssociateRouteTable", "ec2:DisassociateRouteTable", "ec2:DescribeRouteTables",
          "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress", "ec2:DescribeSecurityGroups", "ec2:DescribeSecurityGroupRules",
          "ec2:CreateTags", "ec2:DeleteTags", "ec2:DescribeTags",
          "ec2:DescribeAvailabilityZones", "ec2:DescribeAccountAttributes",
          "ec2:DescribeNetworkInterfaces", "ec2:CreateNetworkInterface", "ec2:DeleteNetworkInterface",
          "ec2:DescribeVpcAttribute"
        ]
        Resource = "*"
      },
      # Elastic Load Balancing (for webapp ALB)
      {
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:*"]
        Resource = "*"
      },
      # Application Auto Scaling (for ECS webapp autoscaling — resource-level restrictions not supported by AWS)
      {
        Effect   = "Allow"
        Action   = ["application-autoscaling:*"]
        Resource = "*"
      },
      # CloudWatch Alarms
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:ListTagsForResource",
          "cloudwatch:TagResource",
          "cloudwatch:UntagResource"
        ]
        Resource = "arn:aws:cloudwatch:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alarm:${var.project_name}-*"
      },
      # CloudWatch Dashboards — created by the monitoring module in every env
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutDashboard",
          "cloudwatch:DeleteDashboards",
          "cloudwatch:GetDashboard",
          "cloudwatch:ListDashboards"
        ]
        Resource = "arn:aws:cloudwatch::${data.aws_caller_identity.current.account_id}:dashboard/${var.project_name}-*"
      },
      # SNS — project-prefixed topics (alarm notifications)
      {
        Effect = "Allow"
        Action = [
          "sns:CreateTopic",
          "sns:DeleteTopic",
          "sns:GetTopicAttributes",
          "sns:SetTopicAttributes",
          "sns:ListTagsForResource",
          "sns:TagResource",
          "sns:UntagResource",
          "sns:Subscribe",
          "sns:Unsubscribe",
          "sns:GetSubscriptionAttributes",
          "sns:SetSubscriptionAttributes",
          "sns:ListSubscriptionsByTopic"
        ]
        Resource = "arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.project_name}-*"
      },
      # AWS Chatbot — Slack channel configurations for alarm notifications
      {
        Effect = "Allow"
        Action = [
          "chatbot:CreateSlackChannelConfiguration",
          "chatbot:DeleteSlackChannelConfiguration",
          "chatbot:DescribeSlackChannelConfigurations",
          "chatbot:UpdateSlackChannelConfiguration",
          "chatbot:TagResource",
          "chatbot:UntagResource",
          "chatbot:ListTagsForResource"
        ]
        Resource = "*"
      },
      # IAM — only for Lambda execution roles and ECS task roles (scoped)
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
          "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies", "iam:ListInstanceProfilesForRole",
          "iam:PassRole", "iam:TagRole", "iam:UntagRole"
        ]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-*"
        ]
      },
      # Terraform state access
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.tfstate.arn,
          "${aws_s3_bucket.tfstate.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.tflock.arn
      }
    ]
  })
}

# ─── Monitoring Deploy Role ──────────────────────────────────────────────────
# Separate OIDC-trusted role for cd-monitoring-deploy.yml.
# Scoped to: IAM (monitoring role), S3 (monitoring tfstate bucket),
# DynamoDB (monitoring tflock table), CloudWatch Dashboards.
# Does NOT have access to application Lambda functions, RDS, SQS, etc.

resource "aws_iam_role" "monitoring_deploy" {
  name = "${var.project_name}-monitoring-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "${local.oidc_provider_url}:sub" = "repo:${var.github_org}/${var.github_repo}:*"
          }
          StringEquals = {
            "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  max_session_duration = 3600 # 1 hour is sufficient for monitoring deployments
}

resource "aws_iam_role_policy" "monitoring_deploy" {
  name = "${var.project_name}-monitoring-deploy-policy"
  role = aws_iam_role.monitoring_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # IAM — create/manage the monitoring API role and its policies
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
          "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
          "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:GetPolicyVersion",
          "iam:ListPolicyVersions", "iam:CreatePolicyVersion", "iam:DeletePolicyVersion",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies", "iam:TagRole", "iam:UntagRole", "iam:PassRole",
          "iam:TagPolicy", "iam:UntagPolicy"
        ]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-monitoring-*",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.project_name}-monitoring-*"
        ]
      },
      # S3 — read/write main tfstate bucket (monitoring state stored under monitoring/ key prefix)
      {
        Effect = "Allow"
        Action = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          aws_s3_bucket.tfstate.arn,
          "${aws_s3_bucket.tfstate.arn}/monitoring/*"
        ]
      },
      # S3 — read/write artifact bucket (for Lambda ZIP uploads)
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/monitoring/*"
        ]
      },
      # DynamoDB — main tflock table (for state locking)
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.tflock.arn
      },
      # Lambda — create/manage monitoring Lambda functions
      {
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction", "lambda:DeleteFunction", "lambda:GetFunction",
          "lambda:GetFunctionConfiguration", "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration", "lambda:ListTags", "lambda:TagResource",
          "lambda:UntagResource", "lambda:PutFunctionConcurrency",
          "lambda:PublishVersion", "lambda:ListVersionsByFunction",
          "lambda:GetPolicy", "lambda:AddPermission",
          "lambda:RemovePermission", "lambda:GetFunctionUrlConfig",
          "lambda:CreateFunctionUrlConfig", "lambda:UpdateFunctionUrlConfig",
          "lambda:DeleteFunctionUrlConfig",
          "lambda:InvokeFunctionUrl",
          "lambda:GetLayerVersion",
          "lambda:GetFunctionCodeSigningConfig"
        ]
        Resource = [
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*-monitoring-*",
          "arn:aws:lambda:${var.aws_region}:753240598075:layer:LambdaAdapterLayerX86:*",
          "arn:aws:lambda:${var.aws_region}:753240598075:layer:LambdaAdapterLayerArm64:*"
        ]
      },
      # Lambda — wait for function updated
      {
        Effect   = "Allow"
        Action   = ["lambda:GetFunction", "lambda:GetFunctionConfiguration"]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*-monitoring-*"
      },
      # CloudWatch Logs — describe (list-type, requires wildcard resource)
      {
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups"]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:*"
      },
      # CloudWatch Logs — create/manage log groups for monitoring Lambdas
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup", "logs:DeleteLogGroup",
          "logs:PutRetentionPolicy", "logs:ListTagsForResource",
          "logs:TagResource", "logs:UntagResource"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*-monitoring-*"
      },
      # CloudWatch Dashboards — put/delete project-prefixed dashboards
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutDashboard",
          "cloudwatch:DeleteDashboards",
          "cloudwatch:GetDashboard",
          "cloudwatch:ListDashboards"
        ]
        Resource = [
          "arn:aws:cloudwatch::${data.aws_caller_identity.current.account_id}:dashboard/${var.project_name}-*"
        ]
      },
      # ECR — push/pull monitoring-webapp images
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = aws_ecr_repository.monitoring_webapp.arn
      }
    ]
  })
}
