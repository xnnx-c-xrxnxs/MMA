output "lambda_alarm_arns" {
  description = "Map of Lambda error alarm ARNs"
  value = {
    for k, v in aws_cloudwatch_metric_alarm.lambda_errors : k => v.arn
  }
}

output "dlq_alarm_arns" {
  description = "Map of DLQ alarm ARNs"
  value = {
    for k, v in aws_cloudwatch_metric_alarm.dlq_messages : k => v.arn
  }
}

output "dashboard_names" {
  description = "Map of created CloudWatch dashboard names"
  value = {
    services    = length(aws_cloudwatch_dashboard.services) > 0 ? aws_cloudwatch_dashboard.services[0].dashboard_name : ""
    sqs         = length(aws_cloudwatch_dashboard.sqs) > 0 ? aws_cloudwatch_dashboard.sqs[0].dashboard_name : ""
    dynamodb    = length(aws_cloudwatch_dashboard.dynamodb) > 0 ? aws_cloudwatch_dashboard.dynamodb[0].dashboard_name : ""
    rds         = length(aws_cloudwatch_dashboard.rds) > 0 ? aws_cloudwatch_dashboard.rds[0].dashboard_name : ""
    api_gateway = length(aws_cloudwatch_dashboard.api_gateway) > 0 ? aws_cloudwatch_dashboard.api_gateway[0].dashboard_name : ""
  }
}
