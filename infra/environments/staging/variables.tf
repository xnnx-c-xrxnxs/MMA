variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "artifact_bucket" {
  description = "S3 bucket name for Lambda deployment artifacts"
  type        = string
}

variable "deploy_sha" {
  description = "Git SHA for deployment artifact naming"
  type        = string
}

variable "ecr_repo_url" {
  description = "ECR repository URL for webapp images"
  type        = string
}

variable "webapp_image_tag" {
  description = "Docker image tag for the webapp"
  type        = string
  default     = "latest"
}

variable "enable_monitoring" {
  description = "Enable CloudWatch alarms"
  type        = bool
  default     = true
}

variable "rds_instance_class" {
  description = "RDS PostgreSQL instance class (e.g. db.t4g.micro, db.t4g.small, db.t4g.medium)"
  type        = string
  default     = "db.t4g.small"
}

variable "lambda_log_retention_days" {
  description = "CloudWatch log retention for Lambda functions"
  type        = number
  default     = 30
}

variable "force_destroy" {
  description = "If true, disable deletion protection and skip final snapshot (used by destroy workflow)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}

variable "sensitive_vars" {
  description = "Sensitive key-value pairs injected into Secrets Manager (e.g. third-party API keys). Set via the SENSITIVE_VARS GitHub secret — never hardcoded."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "adot_layer_id" {
  description = "The <layer-name>:<version> of the ADOT Lambda layer. The ARN is constructed from the current region automatically. Format: aws-otel-nodejs-amd64-ver-X-Y-Z:1. Set to empty string to disable. See https://aws-otel.github.io/docs/getting-started/lambda/lambda-js for current value."
  type        = string
  default     = ""
}
