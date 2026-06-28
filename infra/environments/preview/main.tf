# ─── Preview Environment Root ────────────────────────────────────────────────
# Fully isolated per preview_name. Reduced defaults. No monitoring.
# State stored at: s3://{project}-tfstate/preview/{preview_name}/terraform.tfstate

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = "preview-${var.preview_name}"
      PreviewName = var.preview_name
      ManagedBy   = "terraform"
    })
  }
}

locals {
  registry    = jsondecode(file("${path.module}/../../../.github/service-registry.json"))
  environment = "preview-${var.preview_name}"

  # Auto-derive VPC requirement from the registry — no manual enable_vpc variable needed.
  # VPC is created when: RDS databases exist, any service needs VPC, or the webapp runs on ECS (needs ALB).
  requires_vpc = (
    length(try(local.registry.infrastructure.rds, [])) > 0 ||
    anytrue([for s in concat(local.registry.apiServices, local.registry.eventHandlerServices) : try(s.requiresVpc, false)]) ||
    (var.enable_webapp && local.webapp_mode == "ecs")
  )

  # Webapp deployment mode — "ecs" or "lambda" — driven by service-registry.json
  webapp_mode = try(local.registry.webapp.deploymentMode["preview"], "ecs")

  # Raw webapp origin URL (before CloudFront). Used as CloudFront origin.
  # Empty string for static mode — module.cloudfront_webapp has count=0 when static.
  webapp_origin_url = !var.enable_webapp ? "" : (
    local.webapp_mode == "ecs"    ? "http://${module.webapp[0].alb_dns_name}" :
    local.webapp_mode == "lambda" ? trimsuffix(module.webapp_lambda[0].function_url, "/") :
    ""
  )

  # Public-facing webapp URL.
  webapp_base_url = !var.enable_webapp ? "" : (
    local.webapp_mode == "static"
    ? "https://${module.static_webapp[0].distribution_domain_name}"
    : "https://${module.cloudfront_webapp[0].domain_name}"
  )
}

# ─── Networking (optional — required for RDS PostgreSQL, VPC Lambdas, and webapp) ────

module "networking" {
  count  = local.requires_vpc ? 1 : 0
  source = "../../modules/networking"

  project_name = var.project_name
  environment  = local.environment
  tags         = var.tags
}

# ─── DynamoDB Tables ────────────────────────────────────────────────────────

module "dynamodb" {
  source   = "../../modules/dynamodb"
  for_each = { for t in local.registry.infrastructure.dynamodbTables : t.domain => t }

  table_name  = "${var.project_name}-${local.environment}-${each.value.domain}"
  domain      = each.value.domain
  gsis        = each.value.gsis
  enable_pitr = false # No PITR for previews
  tags        = var.tags
}

# ─── SQS Queues ─────────────────────────────────────────────────────────────

module "sqs" {
  source   = "../../modules/sqs"
  for_each = { for q in local.registry.infrastructure.sqsQueues : q.envVar => q }

  queue_name = "${var.project_name}-${local.environment}-${each.value.domain}-events"
  fifo       = each.value.fifo
  tags       = var.tags
}

# ─── S3 Buckets ─────────────────────────────────────────────────────────────

module "s3_buckets" {
  source   = "../../modules/s3"
  for_each = { for b in try(local.registry.infrastructure.s3Buckets, []) : b.name => b }

  bucket_name               = "${var.project_name}-${local.environment}-${each.value.name}"
  versioning                = try(each.value.versioning, false)
  cors_allowed_origins      = try(each.value.cors, false) && var.enable_webapp ? ["*"] : []
  lifecycle_expiration_days = try(each.value.lifecycleDays, 0)
  tags                      = var.tags
}

# ─── RDS PostgreSQL Databases (requires VPC) ──────────────────────────────────

module "rds" {
  source   = "../../modules/rds"
  for_each = local.requires_vpc ? { for db in local.registry.infrastructure.rds : db.domain => db } : {}

  db_identifier        = "${var.project_name}-${local.environment}-${each.value.domain}"
  db_name              = each.value.dbName
  instance_class       = var.rds_instance_class
  is_preview           = true
  db_subnet_group_name = module.networking[0].db_subnet_group_name
  security_group_ids   = [module.networking[0].rds_security_group_id]
  tags                 = var.tags
}

# ─── Cognito User Pool ───────────────────────────────────────────────────────

module "cognito" {
  source = "../../modules/cognito"

  project_name        = var.project_name
  environment         = local.environment
  deletion_protection = false
  tags                = var.tags
}

# ─── API Gateways ───────────────────────────────────────────────────────────

# ─── Shared API Gateway ────────────────────────────────────────────────────────
# CORS is NOT configured here — NestJS handles all CORS (including OPTIONS
# preflights) via app.enableCors({ origin: FE_BASE_URL, credentials: true }).
# This avoids a Terraform cycle: API Gateway needs the webapp URL for CORS,
# but the webapp needs the API Gateway endpoint as an env var.

module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name       = var.project_name
  environment        = local.environment
  log_retention_days = 7
  tags               = var.tags

  jwt_authorizer = {
    enabled  = try(local.registry.gatewayAuth.enabled, false)
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${module.cognito.user_pool_id}"
    audience = [module.cognito.client_id]
  }
}

# ─── Project-Level Secret ───────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "project" {
  count                   = local.requires_vpc ? 1 : 0
  name                    = "${var.project_name}-preview-${var.preview_name}-secrets"
  description             = "All sensitive configuration for preview environment ${var.preview_name}"
  recovery_window_in_days = 0 # instant delete for ephemeral preview environments
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "project" {
  count     = local.requires_vpc ? 1 : 0
  secret_id = aws_secretsmanager_secret.project[0].id
  secret_string = jsonencode(merge(
    {
      for db in local.registry.infrastructure.rds :
      db.envVar => module.rds[db.domain].connection_url
    },
    {
      COGNITO_USER_POOL_ID = module.cognito.user_pool_id
      COGNITO_CLIENT_ID    = module.cognito.client_id
    },
    var.sensitive_vars
  ))
}

# ─── Init Runner (Lambda — one-shot deploy tasks) ───────────────────────────

module "lambda_runner" {
  count  = length(try(local.registry.deployTasks, [])) > 0 ? 1 : 0
  source = "../../modules/lambda-runner"

  project_name = var.project_name
  environment  = local.environment
  s3_bucket    = var.artifact_bucket
  s3_key       = "${var.project_name}/${local.environment}/init-runner/${var.deploy_sha}.zip"
  deploy_tasks = local.registry.deployTasks

  aws_secrets_arn   = length(try(local.registry.infrastructure.rds, [])) > 0 ? aws_secretsmanager_secret.project[0].arn : ""
  enable_secrets    = length(try(local.registry.infrastructure.rds, [])) > 0
  resolved_env_vars = local.resolved_infra_vars

  dynamodb_table_arns    = [for k, v in module.dynamodb : v.table_arn]
  cognito_user_pool_arns = [module.cognito.user_pool_arn]

  subnet_ids         = local.requires_vpc ? module.networking[0].private_subnet_ids : []
  security_group_ids = local.requires_vpc ? [module.networking[0].lambda_security_group_id] : []

  tags = var.tags
}

# ─── Resolved Env Var Map ───────────────────────────────────────────────────

locals {
  resolved_infra_vars = merge(
    { for t in local.registry.infrastructure.dynamodbTables :
      t.envVar => module.dynamodb[t.domain].table_name
    },
    { for q in local.registry.infrastructure.sqsQueues :
      q.envVar => module.sqs[q.envVar].queue_url
    },
    { for q in local.registry.infrastructure.sqsQueues :
      replace(q.envVar, "_NAME", "_URL") => module.sqs[q.envVar].queue_url
    },
    local.requires_vpc ? { "AWS_SECRETS_ARN" = aws_secretsmanager_secret.project[0].arn } : {},
    { for svc in local.registry.apiServices :
      "API_${upper(svc.domain)}_URL" => "${module.api_gateway.api_endpoint}/${svc.domain}/api"
    },
    { for svc in local.registry.apiServices :
      "NEXT_PUBLIC_API_${upper(svc.domain)}_URL" => "${module.api_gateway.api_endpoint}/${svc.domain}/api"
    },
    { for b in try(local.registry.infrastructure.s3Buckets, []) :
      b.envVar => module.s3_buckets[b.name].bucket_name
    },
    # CloudFront file download CDN — domain, key pair ID, and signing key
    { for b in try(local.registry.infrastructure.s3Buckets, []) :
      "CLOUDFRONT_DOMAIN" => module.cloudfront_s3[b.name].domain_name
      if try(b.cloudfront, false)
    },
    { for b in try(local.registry.infrastructure.s3Buckets, []) :
      "CLOUDFRONT_KEY_PAIR_ID" => module.cloudfront_s3[b.name].key_pair_id
      if try(b.cloudfront, false)
    },
    { for b in try(local.registry.infrastructure.s3Buckets, []) :
      "CLOUDFRONT_PRIVATE_KEY" => module.cloudfront_s3[b.name].signing_private_key
      if try(b.cloudfront, false)
    },
    # Auth — compute generic OIDC vars from Cognito outputs so guards are provider-agnostic.
    # To switch providers, replace these four values; no application code changes needed.
    {
      "COGNITO_USER_POOL_ID" = module.cognito.user_pool_id
      "COGNITO_CLIENT_ID"    = module.cognito.client_id
      "JWT_JWKS_URI"         = "https://cognito-idp.${var.aws_region}.amazonaws.com/${module.cognito.user_pool_id}/.well-known/jwks.json"
      "JWT_ISSUER"           = "https://cognito-idp.${var.aws_region}.amazonaws.com/${module.cognito.user_pool_id}"
      "JWT_USER_ID_CLAIM"    = "custom:userId"
      "JWT_USER_ROLE_CLAIM"  = "custom:userRole"
    },
  )

  resolved_all_vars = merge(
    local.resolved_infra_vars,
    {
      "FE_BASE_URL" = local.webapp_base_url
    }
  )
}

# ─── API Services ──────────────────────────────────────────────────────────

module "api_services" {
  source   = "../../modules/lambda-api"
  for_each = { for svc in local.registry.apiServices : svc.name => svc }

  project_name = var.project_name
  environment  = local.environment
  service_name = each.value.name
  domain       = each.value.domain
  api_id       = module.api_gateway.api_id

  jwt_authorizer_id = module.api_gateway.jwt_authorizer_id
  public_routes = [
    for r in try(local.registry.gatewayAuth.publicRoutes, []) :
    { method = r.method, path = r.path }
    if r.service == each.value.name
  ]
  api_execution_arn = module.api_gateway.execution_arn
  s3_bucket         = var.artifact_bucket
  s3_key            = "${var.project_name}/${local.environment}/${each.value.name}/${var.deploy_sha}.zip"
  handler           = each.value.handler
  memory_size       = min(each.value.memorySize, 256) # Cap at 256MB for previews
  timeout           = each.value.timeout

  environment_variables = merge(
    { STAGE = local.environment, NODE_ENV = "production", DOMAIN_PREFIX = each.value.domain, SWAGGER_ENABLED = "true" },
    { for v in each.value.envVars : v => lookup(local.resolved_all_vars, v, "") }
  )

  vpc_config = try(each.value.requiresVpc, false) && local.requires_vpc ? {
    subnet_ids         = module.networking[0].private_subnet_ids
    security_group_ids = [module.networking[0].lambda_security_group_id]
  } : null

  dynamodb_table_arns = [
    for t in local.registry.infrastructure.dynamodbTables :
    module.dynamodb[t.domain].table_arn if t.domain == each.value.domain
  ]

  sqs_publish_arns = [
    for q in local.registry.infrastructure.sqsQueues :
    module.sqs[q.envVar].queue_arn
    if contains(each.value.envVars, replace(q.envVar, "_NAME", "_URL"))
  ]

  secret_arns = local.requires_vpc && contains(each.value.envVars, "AWS_SECRETS_ARN") ? [aws_secretsmanager_secret.project[0].arn] : []
  s3_bucket_arns = [
    for b in try(local.registry.infrastructure.s3Buckets, []) :
    module.s3_buckets[b.name].bucket_arn
  ]

  cognito_user_pool_arns = [module.cognito.user_pool_arn]
  adot_layer_id          = var.adot_layer_id
  log_retention_days     = 7 # Short retention for previews
  tags                   = var.tags
}

# ─── Worker Services ───────────────────────────────────────────────────────

module "worker_services" {
  source   = "../../modules/lambda-worker"
  for_each = { for svc in local.registry.eventHandlerServices : svc.name => svc }

  project_name  = var.project_name
  environment   = local.environment
  service_name  = each.value.name
  s3_bucket     = var.artifact_bucket
  s3_key        = "${var.project_name}/${local.environment}/${each.value.name}/${var.deploy_sha}.zip"
  handler       = each.value.handler
  memory_size   = min(each.value.memorySize, 128) # Cap at 128MB for previews
  timeout       = each.value.timeout
  sqs_queue_arn = module.sqs[each.value.sqsQueueRef].queue_arn

  environment_variables = merge(
    { STAGE = local.environment, NODE_ENV = "production" },
    { for v in each.value.envVars : v => lookup(local.resolved_infra_vars, v, "") }
  )

  vpc_config = try(each.value.requiresVpc, false) && local.requires_vpc ? {
    subnet_ids         = module.networking[0].private_subnet_ids
    security_group_ids = [module.networking[0].lambda_security_group_id]
  } : null

  dynamodb_table_arns = [
    for t in local.registry.infrastructure.dynamodbTables :
    module.dynamodb[t.domain].table_arn if t.domain == each.value.domain
  ]

  sqs_publish_arns = [
    for q in local.registry.infrastructure.sqsQueues :
    module.sqs[q.envVar].queue_arn
    if contains(each.value.envVars, replace(q.envVar, "_NAME", "_URL"))
  ]

  secret_arns = local.requires_vpc && contains(each.value.envVars, "AWS_SECRETS_ARN") ? [aws_secretsmanager_secret.project[0].arn] : []

  s3_bucket_arns = [
    for b in try(local.registry.infrastructure.s3Buckets, []) :
    module.s3_buckets[b.name].bucket_arn
  ]

  cognito_user_pool_arns = [module.cognito.user_pool_arn]

  adot_layer_id      = var.adot_layer_id
  log_retention_days = 7
  tags               = var.tags
}

# ─── Webapp (ECS Fargate — when enable_webapp && deploymentMode is "ecs") ──

module "webapp" {
  count  = var.enable_webapp && local.webapp_mode == "ecs" ? 1 : 0
  source = "../../modules/webapp"

  project_name = var.project_name
  environment  = local.environment

  container_image = "${var.ecr_repo_url}:${var.webapp_image_tag}"
  container_port  = local.registry.webapp.port

  health_check_path = try(local.registry.webapp.healthCheckPath, "/")

  vpc_id                 = module.networking[0].vpc_id
  public_subnet_ids      = module.networking[0].public_subnet_ids
  private_subnet_ids     = module.networking[0].private_subnet_ids
  alb_security_group_ids = [module.networking[0].alb_security_group_id]
  ecs_security_group_ids = [module.networking[0].ecs_security_group_id]

  environment_variables = {
    for v in local.registry.webapp.envVars : v => lookup(local.resolved_infra_vars, v, "")
  }

  cpu                = 256 # Minimal for previews
  memory             = 512
  desired_count      = 1
  enable_autoscaling = false

  tags = var.tags
}

# ─── Webapp (Lambda Web Adapter — when enable_webapp && deploymentMode is "lambda") ──

module "webapp_lambda" {
  count  = var.enable_webapp && local.webapp_mode == "lambda" ? 1 : 0
  source = "../../modules/lambda-webapp"

  project_name = var.project_name
  environment  = local.environment

  image_uri      = "${var.ecr_repo_url}:${var.webapp_image_tag}"
  container_port = local.registry.webapp.port

  environment_variables = {
    for v in local.registry.webapp.envVars : v => lookup(local.resolved_infra_vars, v, "")
  }

  log_retention_days = 7 # Short retention for previews
  tags               = var.tags
}

# ─── CloudFront (Webapp CDN) ───────────────────────────────────────────────────────

module "cloudfront_webapp" {
  count  = var.enable_webapp && local.webapp_mode != "static" ? 1 : 0
  source = "../../modules/cloudfront-webapp"

  project_name = var.project_name
  environment  = local.environment
  origin_url   = local.webapp_origin_url
  tags         = var.tags
}

# ─── Static Webapp (S3 + CloudFront — when enable_webapp && deploymentMode is "static") ──

module "static_webapp" {
  count  = var.enable_webapp && local.webapp_mode == "static" ? 1 : 0
  source = "../../modules/static-webapp"

  project_name = var.project_name
  environment  = local.environment
  tags         = var.tags
}

# ─── CloudFront (S3 File Downloads) ────────────────────────────────────────────────

module "cloudfront_s3" {
  source   = "../../modules/cloudfront-s3"
  for_each = { for b in try(local.registry.infrastructure.s3Buckets, []) : b.name => b if try(b.cloudfront, false) }

  project_name              = var.project_name
  environment               = local.environment
  s3_bucket_id              = module.s3_buckets[each.key].bucket_name
  s3_bucket_arn             = module.s3_buckets[each.key].bucket_arn
  s3_bucket_regional_domain = module.s3_buckets[each.key].bucket_regional_domain_name
  tags                      = var.tags
}

# No monitoring module for previews — saves cost and reduces noise.
