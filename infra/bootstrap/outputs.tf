output "state_bucket_name" {
  description = "S3 bucket name for Terraform remote state"
  value       = aws_s3_bucket.tfstate.id
}

output "state_bucket_arn" {
  description = "S3 bucket ARN for Terraform remote state"
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table_name" {
  description = "DynamoDB table name for Terraform state locking"
  value       = aws_dynamodb_table.tflock.name
}

output "artifact_bucket_name" {
  description = "S3 bucket name for Lambda deployment ZIPs"
  value       = aws_s3_bucket.artifacts.id
}

output "artifact_bucket_arn" {
  description = "S3 bucket ARN for Lambda deployment ZIPs"
  value       = aws_s3_bucket.artifacts.arn
}

output "deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions to assume via OIDC"
  value       = aws_iam_role.deploy.arn
}

output "ecr_repo_url" {
  description = "ECR repository URL for webapp Docker images"
  value       = aws_ecr_repository.webapp.repository_url
}

output "ecr_repo_name" {
  description = "ECR repository name for webapp Docker images"
  value       = aws_ecr_repository.webapp.name
}

output "monitoring_ecr_repo_url" {
  description = "ECR repository URL for monitoring-webapp Docker images"
  value       = aws_ecr_repository.monitoring_webapp.repository_url
}

output "monitoring_ecr_repo_name" {
  description = "ECR repository name for monitoring-webapp Docker images"
  value       = aws_ecr_repository.monitoring_webapp.name
}

output "monitoring_deploy_role_arn" {
  description = "IAM role ARN for cd-monitoring-deploy.yml to assume via OIDC"
  value       = aws_iam_role.monitoring_deploy.arn
}

