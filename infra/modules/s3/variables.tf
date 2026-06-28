variable "bucket_name" {
  description = "S3 bucket name (fully qualified with project-env prefix)"
  type        = string
}

variable "versioning" {
  description = "Enable bucket versioning"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS (e.g. webapp URL for browser-based uploads). Empty = no CORS."
  type        = list(string)
  default     = []
}

variable "lifecycle_expiration_days" {
  description = "Number of days after which objects expire. 0 = no lifecycle rule."
  type        = number
  default     = 0
}
