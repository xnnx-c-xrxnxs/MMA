variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "container_port" {
  description = "Port Next.js listens on"
  type        = number
  default     = 3000
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 512
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

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "image_uri" {
  description = "ECR image URI for the webapp container"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
