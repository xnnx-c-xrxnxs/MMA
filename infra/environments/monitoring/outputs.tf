output "monitoring_role_arn" {
  description = "IAM role ARN for monitoring-api-service Lambda"
  value       = aws_iam_role.monitoring_api.arn
}

output "monitoring_role_name" {
  description = "IAM role name for monitoring-api-service Lambda"
  value       = aws_iam_role.monitoring_api.name
}

output "monitoring_api_function_url" {
  description = "Public Function URL for monitoring-api-service Lambda"
  value       = aws_lambda_function_url.monitoring_api.function_url
}

output "monitoring_webapp_function_url" {
  description = "Public Function URL for monitoring-webapp Lambda"
  value       = aws_lambda_function_url.monitoring_webapp.function_url
}
