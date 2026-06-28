variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "service_name" {
  description = "Service name from registry (e.g., user-event-handler-service)"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket containing the Lambda ZIP"
  type        = string
}

variable "s3_key" {
  description = "S3 object key for the Lambda ZIP"
  type        = string
}

variable "handler" {
  description = "Lambda handler"
  type        = string
  default     = "main.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs24.x"
}

variable "architecture" {
  description = "Lambda CPU architecture: x86_64 or arm64. ARM64 (Graviton2) is ~20% cheaper."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["x86_64", "arm64"], var.architecture)
    error_message = "architecture must be x86_64 or arm64"
  }
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 60
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "sqs_queue_arn" {
  description = "SQS queue ARN to consume from"
  type        = string
}

variable "batch_size" {
  description = "SQS event source batch size"
  type        = number
  default     = 10
}

variable "vpc_config" {
  description = "Optional VPC configuration"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "dynamodb_table_arns" {
  description = "DynamoDB table ARNs the function needs access to"
  type        = list(string)
  default     = []
}

variable "sqs_publish_arns" {
  description = "SQS queue ARNs the function needs to publish to"
  type        = list(string)
  default     = []
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the function needs to read"
  type        = list(string)
  default     = []
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the function needs runtime access to"
  type        = list(string)
  default     = []
}

variable "cognito_user_pool_arns" {
  description = "Cognito User Pool ARNs the function needs admin access to"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "adot_layer_id" {
  description = "The <layer-name>:<version> suffix of the ADOT Lambda layer. The full ARN is constructed automatically using the current AWS region. Format: aws-otel-nodejs-amd64-ver-X-Y-Z:1. Set to empty string to disable X-Ray tracing. See https://aws-otel.github.io/docs/getting-started/lambda/lambda-js for the current value."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
