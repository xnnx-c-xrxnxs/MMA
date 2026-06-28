variable "name_prefix" {
  description = "Prefix for all alarm names (e.g. project-env). Must match IAM resource pattern."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod). Used in dashboard titles."
  type        = string
  default     = ""
}

variable "enable_alarms" {
  description = "Enable CloudWatch alarms (disable for preview environments)"
  type        = bool
  default     = true
}

variable "enable_dashboards" {
  description = "Enable CloudWatch dashboards. Can be disabled independently of alarms."
  type        = bool
  default     = true
}

variable "lambda_functions" {
  description = "Map of alarm key => function name for Lambda error alarms"
  type        = map(string)
  default     = {}
}

variable "lambda_error_threshold" {
  description = "Error count threshold per 5-minute period"
  type        = number
  default     = 5
}

variable "lambda_throttle_threshold" {
  description = "Lambda throttle count threshold per 5-minute period"
  type        = number
  default     = 10
}

variable "lambda_duration_threshold_ms" {
  description = "Lambda p99 duration alarm threshold in milliseconds"
  type        = number
  default     = 10000
}

variable "dlq_arns" {
  description = "Map of alarm key => DLQ queue name for SQS DLQ alarms"
  type        = map(string)
  default     = {}
}

variable "sqs_queues" {
  description = "Map of queue key => queue name for SQS health dashboard widgets (main queues, not DLQs)"
  type        = map(string)
  default     = {}
}

variable "dynamodb_tables" {
  description = "Map of table key => table name for DynamoDB dashboard and throttle alarms"
  type        = map(string)
  default     = {}
}

variable "dynamodb_throttle_threshold" {
  description = "DynamoDB throttled request count threshold per 5-minute period"
  type        = number
  default     = 5
}

variable "rds_instances" {
  description = "Map of instance key => RDS instance identifier for RDS dashboard and alarms"
  type        = map(string)
  default     = {}
}

variable "rds_connections_threshold" {
  description = "RDS DatabaseConnections alarm threshold"
  type        = number
  default     = 80
}

variable "api_gateway_id" {
  description = "API Gateway HTTP API ID for API Gateway dashboard and 5XX alarm"
  type        = string
  default     = ""
}

variable "enable_api_gateway_monitoring" {
  description = "Whether to create the API Gateway 5XX alarm and dashboard widget. Must be a static boolean — not derived from a computed resource output — so Terraform can evaluate count at plan time on fresh environments. Defaults to true (api_gateway_id is always passed in the standard template)."
  type        = bool
  default     = true
}

variable "api_gateway_5xx_threshold" {
  description = "API Gateway 5XX error count threshold per 5-minute period"
  type        = number
  default     = 5
}

variable "aws_region" {
  description = "AWS region — used in dashboard widget metric references"
  type        = string
  default     = "eu-west-2"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications. When non-empty, all alarms send state changes (ALARM + OK) to this topic. Provided by the notifications module."
  type        = string
  default     = ""
}
