variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod, preview-{name})"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID (name) — the bucket to front with CloudFront"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN — used for the bucket policy Condition"
  type        = string
}

variable "s3_bucket_regional_domain" {
  description = "S3 bucket regional domain name (e.g. bucket.s3.eu-west-2.amazonaws.com)"
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
