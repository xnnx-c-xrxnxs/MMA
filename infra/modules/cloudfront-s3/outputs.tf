output "domain_name" {
  description = "CloudFront distribution domain name for file downloads"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.this.arn
}

output "key_pair_id" {
  description = "CloudFront key pair ID for generating signed URLs"
  value       = aws_cloudfront_public_key.signing.id
}

output "signing_private_key" {
  description = "Private key PEM for generating CloudFront signed URLs"
  value       = tls_private_key.signing.private_key_pem
  sensitive   = true
}
