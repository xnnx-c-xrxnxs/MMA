variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "service_name" {
  description = "Service name from registry (e.g., user-api-service)"
  type        = string
}

variable "domain" {
  description = "Domain name for path-based routing (e.g., user, product, order)"
  type        = string
}

variable "api_id" {
  description = "API Gateway HTTP API ID (created by api-gateway module)"
  type        = string
}

variable "api_execution_arn" {
  description = "API Gateway execution ARN (for Lambda permissions)"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket containing the Lambda ZIP"
  type        = string
}

variable "s3_key" {
  description = "S3 object key for the Lambda ZIP"
  type        = string
}

variable "handler" {
  description = "Lambda handler (run.sh for Lambda Web Adapter)"
  type        = string
  default     = "run.sh"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs24.x"
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "vpc_config" {
  description = "Optional VPC configuration for the Lambda function"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "dynamodb_table_arns" {
  description = "DynamoDB table ARNs the function needs access to"
  type        = list(string)
  default     = []
}

variable "sqs_publish_arns" {
  description = "SQS queue ARNs the function needs to publish to"
  type        = list(string)
  default     = []
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the function needs to read"
  type        = list(string)
  default     = []
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the function needs runtime access to (GetObject, PutObject, DeleteObject)"
  type        = list(string)
  default     = []
}

variable "cognito_user_pool_arns" {
  description = "Cognito User Pool ARNs the function needs admin access to"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "adot_layer_id" {
  description = "The <layer-name>:<version> suffix of the ADOT Lambda layer. The full ARN is constructed automatically using the current AWS region. The architecture suffix (amd64/arm64) is auto-swapped to match the Lambda architecture. Format: aws-otel-nodejs-amd64-ver-X-Y-Z:1. Set to empty string to disable X-Ray tracing."
  type        = string
  default     = ""
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

variable "lambda_web_adapter_version" {
  description = "Version number of the AWS Lambda Web Adapter layer. See https://github.com/aws/aws-lambda-web-adapter"
  type        = number
  default     = 27
}

variable "service_port" {
  description = "Port the NestJS HTTP server listens on inside the Lambda container. Lambda Web Adapter proxies requests to this port."
  type        = number
  default     = 8080
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

# ─── Gateway-side JWT authorization ─────────────────────────────────────────
# Two-tier auth strategy. When jwt_authorizer_id is non-empty, the catch-all
# proxy route requires a valid JWT (validated by API Gateway). Routes listed
# in public_routes get a dedicated authorization_type=NONE override so they
# are reachable without credentials. The path values must be the gateway-side
# path AFTER the /{domain} prefix is stripped — i.e. exactly what NestJS sees.

variable "jwt_authorizer_id" {
  description = "JWT authorizer ID from the api-gateway module. Empty string disables gateway-side auth (NestJS still enforces its own JwtAuthGuard)."
  type        = string
  default     = ""
}

variable "enable_cors_route" {
  description = "Whether to create the OPTIONS preflight route that bypasses the JWT authorizer. Must be a static boolean — not derived from a computed resource output — so Terraform can evaluate the count at plan time. Defaults to true (matches the standard template where jwt_authorizer_id is always set)."
  type        = bool
  default     = true
}

variable "public_routes" {
  description = "Routes that bypass the JWT authorizer. Each path is appended to /{var.domain}. Sourced from .github/service-registry.json → gatewayAuth.publicRoutes filtered to this service."
  type = list(object({
    method = string
    path   = string
  }))
  default = []
}
