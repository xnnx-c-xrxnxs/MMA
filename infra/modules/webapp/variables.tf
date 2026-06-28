variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "container_image" {
  description = "Docker image URI (ECR URL with tag)"
  type        = string
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "Fargate task CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory in MB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of running tasks"
  type        = number
  default     = 1
}

variable "max_count" {
  description = "Maximum number of tasks for auto-scaling"
  type        = number
  default     = 4
}

variable "enable_autoscaling" {
  description = "Enable CPU-based auto-scaling"
  type        = bool
  default     = true
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "ALB health check path"
  type        = string
  default     = "/"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_ids" {
  description = "Security group IDs for the ALB"
  type        = list(string)
}

variable "ecs_security_group_ids" {
  description = "Security group IDs for ECS tasks"
  type        = list(string)
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
