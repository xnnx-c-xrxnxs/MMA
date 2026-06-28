variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS. When empty, API Gateway does not handle CORS — NestJS handles it instead (including OPTIONS preflights). This is the default to avoid Terraform cycles between the webapp URL and API Gateway endpoint."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days for access logs"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

# ─── JWT Authorizer ─────────────────────────────────────────────────────────
# When jwt_authorizer.enabled = true, a Cognito-compatible JWT authorizer is
# attached to the API. Per-route auth (NONE for /health, /sign-in, etc.) is
# applied by the lambda-api module using its public_routes input.

variable "jwt_authorizer" {
  description = <<-EOT
    Optional JWT authorizer configuration. When enabled=true, creates a JWT
    authorizer on the HTTP API. lambda-api module routes attach to it by ID
    (passed via var.jwt_authorizer_id). Compatible with Cognito User Pools
    (set jwks_uri to the pool's well-known URL and issuer to the pool URL).
  EOT
  type = object({
    enabled  = bool
    issuer   = string
    audience = list(string)
  })
  default = {
    enabled  = false
    issuer   = ""
    audience = []
  }
}
