variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod, preview-*)"
  type        = string
}

variable "password_min_length" {
  description = "Minimum password length"
  type        = number
  default     = 8
}

variable "temporary_password_validity_days" {
  description = "Number of days a temporary password is valid"
  type        = number
  default     = 7
}

variable "access_token_validity_minutes" {
  description = "Access token validity in minutes"
  type        = number
  default     = 60
}

variable "id_token_validity_minutes" {
  description = "ID token validity in minutes"
  type        = number
  default     = 60
}

variable "refresh_token_validity_days" {
  description = "Refresh token validity in days"
  type        = number
  default     = 30
}

variable "deletion_protection" {
  description = "Enable deletion protection on the user pool"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
