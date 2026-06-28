output "preview_name" {
  description = "Preview environment name"
  value       = var.preview_name
}

output "api_urls" {
  description = "Map of domain => API invoke URL"
  value       = { for svc in local.registry.apiServices : svc.domain => "${module.api_gateway.api_endpoint}/${svc.domain}/api" }
}

output "webapp_url" {
  description = "Webapp URL (ALB, Lambda Function URL, or CloudFront depending on deployment mode)"
  value       = var.enable_webapp ? local.webapp_base_url : "N/A (webapp disabled)"
}

output "webapp_mode" {
  description = "Webapp deployment mode (ecs, lambda, or static)"
  value       = local.webapp_mode
}

output "webapp_static_bucket" {
  description = "S3 bucket name for static webapp (only when deploymentMode is 'static' and enable_webapp is true)"
  value       = var.enable_webapp && local.webapp_mode == "static" ? module.static_webapp[0].bucket_name : ""
}

output "webapp_cf_distribution" {
  description = "CloudFront distribution ID for static webapp (only when deploymentMode is 'static' and enable_webapp is true)"
  value       = var.enable_webapp && local.webapp_mode == "static" ? module.static_webapp[0].distribution_id : ""
}

output "dynamodb_table_names" {
  description = "Map of domain => table name"
  value       = { for k, v in module.dynamodb : k => v.table_name }
}

output "sqs_queue_urls" {
  description = "Map of env var key => queue URL"
  value       = { for k, v in module.sqs : k => v.queue_url }
}

output "rds_endpoints" {
  description = "Map of domain => RDS instance endpoint (empty if VPC disabled)"
  value       = { for k, v in module.rds : k => v.cluster_endpoint }
}

output "requires_vpc" {
  description = "Whether VPC was auto-provisioned for this preview (derived from service-registry.json)"
  value       = local.requires_vpc
}

output "all_urls" {
  description = "Summary of all URLs for this preview (post to workflow summary)"
  value = merge(
    { for svc in local.registry.apiServices : "API: ${svc.domain}" => "${module.api_gateway.api_endpoint}/${svc.domain}/api" },
    var.enable_webapp ? { "Webapp" = local.webapp_base_url } : {}
  )
}

output "init_runner_config" {
  description = "Init runner Lambda config for CD workflows (empty object = no tasks)"
  value = length(try(module.lambda_runner, [])) > 0 ? jsonencode({
    function_name = module.lambda_runner[0].function_name
  }) : "{}"
}
