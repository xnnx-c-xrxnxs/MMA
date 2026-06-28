# ─── CloudFront S3 Module ────────────────────────────────────────────────────
# Places a CloudFront distribution in front of an S3 bucket using Origin Access
# Control (OAC). Downloads go through CloudFront signed URLs with configurable
# long expiry and edge caching. Uploads still use S3 presigned PUT URLs directly.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# ─── Signing Key Pair ──────────────────────────────────────────────────────
# RSA key pair for CloudFront signed URLs. The public key is uploaded to
# CloudFront; the private key is passed to the file service Lambda as an
# environment variable (encrypted at rest by Lambda). Each environment gets
# its own independent key pair.

resource "tls_private_key" "signing" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "aws_cloudfront_public_key" "signing" {
  name        = "${var.project_name}-${var.environment}-cf-signing"
  encoded_key = tls_private_key.signing.public_key_pem
  comment     = "Signing key for ${var.project_name} ${var.environment} file downloads"
}

resource "aws_cloudfront_key_group" "signing" {
  name    = "${var.project_name}-${var.environment}-cf-signing"
  items   = [aws_cloudfront_public_key.signing.id]
  comment = "Key group for ${var.project_name} ${var.environment} signed URLs"
}

# ─── Origin Access Control ──────────────────────────────────────────────────
# OAC replaces the legacy Origin Access Identity (OAI). It signs requests from
# CloudFront to S3 using SigV4, so the bucket stays fully private.

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.project_name}-${var.environment}-files-oac"
  description                       = "OAC for ${var.project_name} ${var.environment} files bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── CloudFront Distribution ───────────────────────────────────────────────

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = "${var.project_name}-${var.environment}-files"
  price_class         = var.price_class
  wait_for_deployment = false

  origin {
    domain_name              = var.s3_bucket_regional_domain
    origin_id                = "s3-files"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-files"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Require signed URLs — only requests with a valid CloudFront signature
    # can access the files. The key group controls which key pairs are valid.
    trusted_key_groups = [aws_cloudfront_key_group.signing.id]

    # AWS managed policy — CachingOptimized (cache files at edge locations)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-files"
  })
}

# ─── S3 Bucket Policy (allow CloudFront OAC read access) ──────────────────
# The bucket remains fully private. Only CloudFront (via OAC) can read objects.
# Direct S3 presigned PUT URLs for uploads are unaffected — they use the
# caller's IAM credentials, not the bucket policy.

resource "aws_s3_bucket_policy" "cloudfront" {
  bucket = var.s3_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.s3_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
          }
        }
      }
    ]
  })
}
