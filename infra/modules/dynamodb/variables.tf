variable "table_name" {
  description = "DynamoDB table name (fully qualified with project-env prefix)"
  type        = string
}

variable "domain" {
  description = "Domain name for tagging (e.g., user, product)"
  type        = string
  default     = ""
}

variable "gsis" {
  description = "List of GSI configurations from service-registry.json"
  type = list(object({
    indexName   = string
    hashKey     = string
    hashKeyType = optional(string, "S")
    sortKey     = optional(string)
    sortKeyType = optional(string, "S")
  }))
  default = []
}

variable "enable_pitr" {
  description = "Enable Point-In-Time Recovery (disable for preview environments)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
