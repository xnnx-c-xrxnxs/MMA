variable "secret_name" {
  description = "Secrets Manager secret name"
  type        = string
}

variable "description" {
  description = "Secret description"
  type        = string
  default     = ""
}

variable "secret_value" {
  description = "Explicit secret value (if null, generates a random password)"
  type        = string
  default     = null
  sensitive   = true
}

variable "password_length" {
  description = "Length of generated password"
  type        = number
  default     = 32
}

variable "include_special" {
  description = "Include special characters in generated password"
  type        = bool
  default     = false
}

variable "recovery_window_days" {
  description = "Number of days before permanent deletion (0 for immediate, use for preview)"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
