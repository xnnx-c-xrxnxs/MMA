variable "project_name" {
  description = "Project name prefix for all resources (must match main deployment)"
  type        = string
}

variable "environment" {
  description = "Target environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "aws_account_id" {
  description = "AWS account ID — used to scope IAM policy resource ARNs"
  type        = string
}

variable "monitoring_ecr_repo_url" {
  description = "ECR repository URL for monitoring-webapp Docker images (from bootstrap)"
  type        = string
  default     = ""
}

variable "monitoring_webapp_image_tag" {
  description = "Docker image tag for monitoring-webapp (set by CD workflow)"
  type        = string
  default     = "latest"
}

variable "lambda_web_adapter_version" {
  description = "Version number of the AWS Lambda Web Adapter layer (LambdaAdapterLayerX86)"
  type        = number
  default     = 27
}

variable "monitoring_api_memory" {
  description = "Memory (MB) for monitoring-api-service Lambda"
  type        = number
  default     = 256
}

variable "monitoring_api_timeout" {
  description = "Timeout (seconds) for monitoring-api-service Lambda"
  type        = number
  default     = 30
}

variable "monitoring_webapp_memory" {
  description = "Memory (MB) for monitoring-webapp Lambda"
  type        = number
  default     = 512
}

variable "monitoring_webapp_timeout" {
  description = "Timeout (seconds) for monitoring-webapp Lambda"
  type        = number
  default     = 30
}

variable "monitoring_api_env_vars" {
  description = "GitHub OAuth env vars for monitoring-api-service Lambda (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REQUIRED_ORG). MONITORING_JWT_SECRET is auto-generated. MONITORING_API_BASE_URL and MONITORING_WEBAPP_URL are injected by the CD workflow."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}
