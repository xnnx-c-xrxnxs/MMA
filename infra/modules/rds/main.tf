# ─── RDS PostgreSQL Module ───────────────────────────────────────────────────
# Creates a single-instance RDS PostgreSQL database.
# Password is generated and stored in Secrets Manager.
# Cheaper and simpler than Aurora Serverless v2 for steady workloads.

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

# ─── Random Password ────────────────────────────────────────────────────────

resource "random_password" "master" {
  length  = 32
  special = false # Avoid URL-encoding issues in connection strings
}

# ─── Secrets Manager ────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.db_identifier}-rds-secret"
  description             = "RDS master credentials for ${var.db_identifier}"
  recovery_window_in_days = var.is_preview ? 0 : 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
    # Full connection URL for convenience
    url = "postgresql://${var.master_username}:${random_password.master.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"
  })
}

# ─── RDS Instance ───────────────────────────────────────────────────────────

resource "aws_db_instance" "this" {
  identifier     = var.db_identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.master_username
  password = random_password.master.result

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = var.security_group_ids

  storage_type      = "gp3"
  allocated_storage = 20
  storage_encrypted = true

  multi_az = var.multi_az

  backup_retention_period = var.is_preview ? 0 : 7
  skip_final_snapshot     = var.skip_final_snapshot != null ? var.skip_final_snapshot : var.is_preview
  final_snapshot_identifier = (var.skip_final_snapshot != null ? var.skip_final_snapshot : var.is_preview) ? null : "${var.db_identifier}-final"

  deletion_protection = !var.is_preview

  # Automatically apply minor version upgrades during the maintenance window.
  # AWS will upgrade e.g. 16.3 → 16.11 without manual intervention.
  # Major version upgrades (16 → 17) are never automatic and require explicit action.
  auto_minor_version_upgrade = true

  # Parameter group defaults are fine for PostgreSQL 16
  # Override via parameter_group_name if custom settings are needed

  tags = merge(var.tags, {
    Name = var.db_identifier
  })
}
