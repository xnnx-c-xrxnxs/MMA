variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
}

variable "preview_name" {
  description = "Unique preview environment name (e.g., john-feature-x, qa-sprint-42)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$", var.preview_name))
    error_message = "Preview name must be 3-32 lowercase alphanumeric characters or hyphens."
  }
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

variable "enable_webapp" {
  description = "Deploy webapp (ECS or Lambda — mode from service-registry.json). When mode is ECS, VPC is auto-provisioned."
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS PostgreSQL instance class (low for previews, e.g. db.t4g.micro)"
  type        = string
  default     = "db.t4g.micro"
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
