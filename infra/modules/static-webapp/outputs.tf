output "bucket_name" {
  description = "S3 bucket name for the static webapp"
  value       = aws_s3_bucket.webapp.id
}

output "bucket_arn" {
  description = "S3 bucket ARN for the static webapp"
  value       = aws_s3_bucket.webapp.arn
}

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.webapp.id
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.webapp.domain_name
}

output "webapp_url" {
  description = "Public HTTPS URL for the static webapp"
  value       = "https://${aws_cloudfront_distribution.webapp.domain_name}"
}
