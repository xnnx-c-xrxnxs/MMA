output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarm notifications. Pass this to the monitoring module's alarm_sns_topic_arn variable."
  value       = aws_sns_topic.alarms.arn
}

output "sns_topic_name" {
  description = "Name of the SNS alarm notification topic"
  value       = aws_sns_topic.alarms.name
}
