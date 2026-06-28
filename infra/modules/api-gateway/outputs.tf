output "api_endpoint" {
  description = "API Gateway base URL (e.g., https://abc123.execute-api.eu-west-2.amazonaws.com)"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "api_id" {
  description = "API Gateway HTTP API ID"
  value       = aws_apigatewayv2_api.this.id
}

output "execution_arn" {
  description = "API Gateway execution ARN (for Lambda permissions)"
  value       = aws_apigatewayv2_api.this.execution_arn
}

output "jwt_authorizer_id" {
  description = "JWT authorizer ID (empty string when jwt_authorizer.enabled=false). lambda-api module attaches routes to this ID via authorizer_id."
  value       = var.jwt_authorizer.enabled ? aws_apigatewayv2_authorizer.jwt[0].id : ""
}
