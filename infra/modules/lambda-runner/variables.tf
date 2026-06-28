variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket where the init-runner ZIP is uploaded by the CD workflow"
  type        = string
}

variable "s3_key" {
  description = "S3 key for the init-runner ZIP artifact"
  type        = string
}

variable "deploy_tasks" {
  description = "Array of deploy task objects from service-registry.json deployTasks"
  type        = any
}

variable "aws_secrets_arn" {
  description = "ARN of the project-level Secrets Manager secret (empty string if no secrets needed)"
  type        = string
  default     = ""
}

variable "enable_secrets" {
  description = "Whether to attach Secrets Manager IAM policy"
  type        = bool
  default     = false
}

variable "resolved_env_vars" {
  description = "Pre-resolved infrastructure env vars (table names, queue URLs, etc.)"
  type        = map(string)
  default     = {}
}

variable "dynamodb_table_arns" {
  description = "ARNs of DynamoDB tables the init tasks may write to"
  type        = list(string)
  default     = []
}

variable "cognito_user_pool_arns" {
  description = "ARNs of Cognito User Pools the init tasks may manage users in"
  type        = list(string)
  default     = []
}

variable "subnet_ids" {
  description = "Private subnet IDs for VPC Lambda (empty list = no VPC, for non-RDS tasks)"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "Security group IDs for VPC Lambda (empty list = no VPC)"
  type        = list(string)
  default     = []
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
