# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap Variables
#
# These are set once when a new project is created from the template.
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project slug used to prefix all resource names (e.g., 'acme'). Must be lowercase alphanumeric + hyphens."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project_name))
    error_message = "project_name must be 2-21 chars, start with a letter, lowercase alphanumeric + hyphens only."
  }
}

variable "aws_region" {
  description = "AWS region for all bootstrap resources."
  type        = string
  default     = "eu-west-2"
}

variable "github_org" {
  description = "GitHub organization or user that owns the repository."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without org prefix)."
  type        = string
}

variable "environment" {
  description = "Environment label (e.g., dev, staging, prod). Appended to globally-unique resource names (S3 buckets) to allow one bootstrap per AWS account in a multi-account setup. Leave empty for single-account setups."
  type        = string
  default     = ""

  validation {
    condition     = var.environment == "" || can(regex("^[a-z][a-z0-9-]{0,15}$", var.environment))
    error_message = "environment must be empty or 1-16 chars, start with a letter, lowercase alphanumeric + hyphens only."
  }
}

variable "tags" {
  description = "Additional tags to apply to all bootstrap resources."
  type        = map(string)
  default     = {}
}
