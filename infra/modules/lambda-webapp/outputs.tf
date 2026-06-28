output "function_url" {
  description = "Lambda Function URL (public HTTP endpoint)"
  value       = aws_lambda_function_url.this.function_url
}

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}
