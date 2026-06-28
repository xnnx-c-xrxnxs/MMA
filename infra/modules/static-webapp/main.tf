# ─── Static Webapp Module ────────────────────────────────────────────────────
# Deploys a Next.js static export (output: 'export') to S3 + CloudFront.
# Private S3 bucket — CloudFront is the only public access point via OAC.
# SPA routing: 403/404 from S3 redirect to index.html with HTTP 200.
# Security headers via CloudFront response headers policy.

locals {
  bucket_name = "${var.project_name}-${var.environment}-webapp-static"
}

# ─── S3 Bucket ───────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "webapp" {
  bucket        = local.bucket_name
  force_destroy = true

  tags = var.tags
}

resource "aws_s3_bucket_public_access_block" "webapp" {
  bucket = aws_s3_bucket.webapp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "webapp" {
  bucket = aws_s3_bucket.webapp.id
  versioning_configuration {
    status = "Disabled"
  }
}

# ─── CloudFront Origin Access Control ────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "webapp" {
  name                              = "${var.project_name}-${var.environment}-webapp-oac"
  description                       = "OAC for ${var.project_name} ${var.environment} static webapp"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── CloudFront Security Headers Response Policy ──────────────────────────────

resource "aws_cloudfront_response_headers_policy" "webapp" {
  name = "${var.project_name}-${var.environment}-webapp-headers"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_security_policy {
      # API calls go to api-gateway.amazonaws.com — connect-src 'self' https: covers it.
      # 'unsafe-inline' is required by Next.js for inline styles injected at runtime.
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
      override                = true
    }
  }
}

# ─── CloudFront Distribution ─────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "webapp" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US + Europe

  comment = "${var.project_name}-${var.environment}-webapp"

  origin {
    domain_name              = aws_s3_bucket.webapp.bucket_regional_domain_name
    origin_id                = "S3WebappOrigin"
    origin_access_control_id = aws_cloudfront_origin_access_control.webapp.id
  }

  # Default behavior — CachingDisabled for HTML (must always be fresh for SPA routing)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3WebappOrigin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # CachingDisabled managed policy — HTML is never cached at edge
    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.webapp.id
  }

  # _next/static/* — content-hashed immutable assets, safe for long-lived caching
  ordered_cache_behavior {
    path_pattern           = "_next/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3WebappOrigin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # CachingOptimized managed policy — 24h default TTL, 365d max TTL
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.webapp.id
  }

  # SPA routing — S3 returns 403 (access denied) for missing objects when
  # the bucket is private. Map both 403 and 404 to index.html so the React
  # Router can handle the path on the client side.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

  tags = var.tags
}

# ─── S3 Bucket Policy — Allow CloudFront OAC only ────────────────────────────

resource "aws_s3_bucket_policy" "webapp" {
  bucket = aws_s3_bucket.webapp.id

  # Must wait for public access block to be applied first
  depends_on = [aws_s3_bucket_public_access_block.webapp]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.webapp.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.webapp.arn
          }
        }
      }
    ]
  })
}
