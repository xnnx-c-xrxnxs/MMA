variable "queue_name" {
  description = "SQS queue name (fully qualified with project-env prefix)"
  type        = string
}

variable "fifo" {
  description = "Whether to create a FIFO queue"
  type        = bool
  default     = true
}

variable "visibility_timeout" {
  description = "Visibility timeout in seconds"
  type        = number
  default     = 120
}

variable "message_retention" {
  description = "Message retention period in seconds"
  type        = number
  default     = 345600 # 4 days
}

variable "max_receive_count" {
  description = "Number of receive attempts before sending to DLQ"
  type        = number
  default     = 3
}

variable "receive_wait_time_seconds" {
  description = "Long polling wait time in seconds (0 = short polling, 1-20 = long polling). Long polling reduces empty responses and SQS API costs."
  type        = number
  default     = 20
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
