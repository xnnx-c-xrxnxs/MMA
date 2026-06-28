output "cluster_endpoint" {
  description = "RDS instance endpoint (hostname only, no port)"
  value       = aws_db_instance.this.address
}

output "cluster_reader_endpoint" {
  description = "RDS instance endpoint (same as writer — single instance has no dedicated reader)"
  value       = aws_db_instance.this.address
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.this.db_name
}

output "instance_identifier" {
  description = "RDS DB instance identifier (used for CloudWatch metric dimensions)"
  value       = aws_db_instance.this.id
}

output "connection_secret_arn" {
  description = "Secrets Manager ARN containing DB credentials and connection URL"
  value       = aws_secretsmanager_secret.db.arn
}

output "connection_secret_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.db.name
}

output "cluster_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.this.arn
}

output "connection_url" {
  description = "Full PostgreSQL connection URL (sensitive — contains master password)"
  value       = "postgresql://${var.master_username}:${random_password.master.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"
  sensitive   = true
}

output "port" {
  description = "RDS instance port"
  value       = aws_db_instance.this.port
}

