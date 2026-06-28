# ─── API Gateway Module ─────────────────────────────────────────────────────
# Creates a SINGLE shared HTTP API v2 + default stage with CORS and access logging.
# All API services share this gateway — each gets a path-based route (/{domain}/{proxy+}).
# The gateway URL is available immediately — Lambda wiring happens in lambda-api.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

locals {
  api_name = "${var.project_name}-${var.environment}-api"
}

# ─── CloudWatch Log Group (API Gateway access logs) ─────────────────────────

resource "aws_cloudwatch_log_group" "access_log" {
  name              = "/aws/apigateway/${local.api_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# ─── HTTP API v2 ────────────────────────────────────────────────────────────

locals {
  # When using explicit origins (not wildcard), enable credentials for httpOnly cookie auth.
  # API Gateway v2 does not allow allow_credentials=true with allow_origins=["*"].
  enable_credentials = length(var.cors_allowed_origins) > 0 && !contains(var.cors_allowed_origins, "*")
}

resource "aws_apigatewayv2_api" "this" {
  name          = local.api_name
  protocol_type = "HTTP"

  # CORS is conditional — when no origins are provided, NestJS handles all CORS
  # (including OPTIONS preflights). This avoids a Terraform cycle where the API
  # Gateway needs the webapp URL for CORS, but the webapp needs the API Gateway
  # endpoint as an env var.
  dynamic "cors_configuration" {
    for_each = length(var.cors_allowed_origins) > 0 ? [1] : []
    content {
      allow_origins     = var.cors_allowed_origins
      allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
      allow_headers     = ["Content-Type", "Authorization", "X-Requested-With"]
      allow_credentials = local.enable_credentials
      max_age           = 86400
    }
  }

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access_log.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = var.tags
}

# ─── JWT Authorizer (Cognito-compatible) ────────────────────────────────────
# When enabled, this authorizer is attached to every Lambda route EXCEPT those
# explicitly listed as public via the lambda-api module's public_routes input.
# Two-tier auth: API Gateway validates the JWT signature/issuer/audience and
# rejects with 401 BEFORE the request reaches Lambda, while NestJS still runs
# its own JwtAuthGuard for fine-grained authorization (roles, ownership, etc).

resource "aws_apigatewayv2_authorizer" "jwt" {
  count            = var.jwt_authorizer.enabled ? 1 : 0
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.api_name}-jwt"

  jwt_configuration {
    audience = var.jwt_authorizer.audience
    issuer   = var.jwt_authorizer.issuer
  }
}