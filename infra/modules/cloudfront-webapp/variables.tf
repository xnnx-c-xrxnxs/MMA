variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod, preview-{name})"
  type        = string
}

variable "origin_url" {
  description = "Full URL of the webapp origin (Lambda Function URL or ALB DNS). Protocol is auto-detected."
  type        = string
}

variable "price_class" {
  description = "CloudFront price class. PriceClass_100 = US+Europe (cheapest)."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
