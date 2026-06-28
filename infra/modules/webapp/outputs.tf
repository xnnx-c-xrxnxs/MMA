output "alb_dns_name" {
  description = "ALB DNS name (webapp URL)"
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.this.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.webapp.name
}

output "task_definition_arn" {
  description = "Current task definition ARN"
  value       = aws_ecs_task_definition.webapp.arn
}
