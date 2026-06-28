output "function_name" {
  description = "Name of the init-runner Lambda function"
  value       = aws_lambda_function.runner.function_name
}

output "function_arn" {
  description = "ARN of the init-runner Lambda function"
  value       = aws_lambda_function.runner.arn
}

output "log_group_name" {
  description = "CloudWatch log group for init-runner invocations"
  value       = aws_cloudwatch_log_group.runner.name
}
