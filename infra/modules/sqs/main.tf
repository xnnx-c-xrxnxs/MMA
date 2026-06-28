# ─── SQS Module ──────────────────────────────────────────────────────────────
# Creates a single SQS queue + DLQ pair. Standard or FIFO via var.fifo.
# Called via for_each — one invocation per registry queue.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

locals {
  queue_name = var.fifo ? "${var.queue_name}.fifo" : var.queue_name
  dlq_name   = var.fifo ? "${var.queue_name}-dlq.fifo" : "${var.queue_name}-dlq"
}

# ─── Dead Letter Queue ──────────────────────────────────────────────────────

resource "aws_sqs_queue" "dlq" {
  name                        = local.dlq_name
  fifo_queue                  = var.fifo
  content_based_deduplication = var.fifo
  message_retention_seconds   = 1209600 # 14 days (max)

  tags = merge(var.tags, {
    Name = local.dlq_name
  })
}

# ─── Main Queue ─────────────────────────────────────────────────────────────

resource "aws_sqs_queue" "this" {
  name                        = local.queue_name
  fifo_queue                  = var.fifo
  content_based_deduplication = var.fifo
  visibility_timeout_seconds  = var.visibility_timeout
  message_retention_seconds   = var.message_retention
  receive_wait_time_seconds   = var.receive_wait_time_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = merge(var.tags, {
    Name = local.queue_name
  })
}
