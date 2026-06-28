variable "name_prefix" {
  description = "Prefix for all resource names (e.g. project-env)"
  type        = string
}

variable "notification_emails" {
  description = "List of email addresses to receive alarm notifications. Each must confirm via email link (one-time)."
  type        = list(string)
  default     = []
}

variable "slack_workspace_id" {
  description = "Slack workspace ID (from AWS Chatbot console after OAuth). Leave empty to skip Slack."
  type        = string
  default     = ""
}

variable "slack_channel_id" {
  description = "Slack channel ID (right-click channel → View details → ID at bottom). Leave empty to skip Slack."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
