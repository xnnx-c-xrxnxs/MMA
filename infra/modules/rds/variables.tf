variable "db_identifier" {
  description = "RDS instance identifier (project-env-domain)"
  type        = string
}

variable "db_name" {
  description = "Default database name"
  type        = string
}

variable "master_username" {
  description = "Master username"
  type        = string
  default     = "dbadmin"
}

variable "engine_version" {
  description = "PostgreSQL engine version. Use major version only (\"16\") to auto-select the latest available minor version in the region."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "RDS instance class (e.g. db.t4g.micro, db.t4g.small, db.t4g.medium)"
  type        = string
  default     = "db.t4g.micro"
}

variable "multi_az" {
  description = "Enable Multi-AZ for high availability (recommended for prod)"
  type        = bool
  default     = false
}

variable "db_subnet_group_name" {
  description = "DB subnet group name (from networking module)"
  type        = string
  default     = null
}

variable "security_group_ids" {
  description = "Security group IDs for the RDS instance"
  type        = list(string)
  default     = []
}

variable "is_preview" {
  description = "If true, disable deletion protection, skip final snapshot, and no backups"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "If true, skip creating a final DB snapshot when deleting the instance. Defaults to is_preview. Override to true for dev/non-prod environments where snapshots are not required."
  type        = bool
  default     = null
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
