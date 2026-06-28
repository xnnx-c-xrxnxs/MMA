# ─── Secrets Module ──────────────────────────────────────────────────────────
# Creates a Secrets Manager secret with a random password.
# Used for RDS credentials and any other secrets.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

resource "random_password" "this" {
  length  = var.password_length
  special = var.include_special
}

resource "aws_secretsmanager_secret" "this" {
  name                    = var.secret_name
  description             = var.description
  recovery_window_in_days = var.recovery_window_days

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = var.secret_value != null ? var.secret_value : random_password.this.result
}
