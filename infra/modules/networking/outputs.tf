output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS PostgreSQL instance"
  value       = aws_security_group.aurora.id
}

output "alb_security_group_id" {
  description = "Security group ID for Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS Fargate tasks"
  value       = aws_security_group.ecs.id
}

output "db_subnet_group_name" {
  description = "DB subnet group name for RDS"
  value       = aws_db_subnet_group.aurora.name
}
