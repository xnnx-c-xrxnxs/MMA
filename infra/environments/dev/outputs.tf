# ─── API Gateway URLs ────────────────────────────────────────────────────────

output "api_urls" {
  description = "Map of domain => API invoke URL"
  value = {
    for svc in local.registry.apiServices : svc.domain => "${module.api_gateway.api_endpoint}/${svc.domain}/api"
  }
}

# ─── Webapp ─────────────────────────────────────────────────────────────────

output "webapp_url" {
  description = "Webapp URL (ALB, Lambda Function URL, or CloudFront depending on deployment mode)"
  value       = local.webapp_base_url
}

output "webapp_mode" {
  description = "Webapp deployment mode (ecs, lambda, or static)"
  value       = local.webapp_mode
}

output "webapp_static_bucket" {
  description = "S3 bucket name for static webapp (only when deploymentMode is 'static')"
  value       = local.webapp_mode == "static" ? module.static_webapp[0].bucket_name : ""
}

output "webapp_cf_distribution" {
  description = "CloudFront distribution ID for static webapp (only when deploymentMode is 'static')"
  value       = local.webapp_mode == "static" ? module.static_webapp[0].distribution_id : ""
}

# ─── DynamoDB ───────────────────────────────────────────────────────────────

output "dynamodb_table_names" {
  description = "Map of domain => table name"
  value = {
    for k, v in module.dynamodb : k => v.table_name
  }
}

# ─── SQS ────────────────────────────────────────────────────────────────────

output "sqs_queue_urls" {
  description = "Map of env var key => queue URL"
  value = {
    for k, v in module.sqs : k => v.queue_url
  }
}

# ─── RDS PostgreSQL ─────────────────────────────────────────────────────────

output "rds_endpoints" {
  description = "Map of domain => RDS instance endpoint"
  value = {
    for k, v in module.rds : k => v.cluster_endpoint
  }
}

output "rds_secret_arns" {
  description = "Map of domain => Secrets Manager ARN for DB credentials"
  value = {
    for k, v in module.rds : k => v.connection_secret_arn
  }
}

# ─── Init Runner ────────────────────────────────────────────────────────────

output "init_runner_config" {
  description = "Init runner Lambda config for CD workflows (empty object = no tasks)"
  value = length(try(module.lambda_runner, [])) > 0 ? jsonencode({
    function_name = module.lambda_runner[0].function_name
  }) : "{}"
}
