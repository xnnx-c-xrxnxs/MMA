# ─── CloudFront Webapp Module ────────────────────────────────────────────────
# Places a CloudFront distribution in front of the webapp origin (Lambda Function
# URL or ALB). Provides a stable HTTPS URL, global edge caching of static assets,
# and a future attachment point for custom domains (ACM + Route 53).

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

locals {
  # Strip scheme and trailing slash from the origin URL to get the domain name.
  origin_domain   = replace(replace(var.origin_url, "https://", ""), "http://", "")
  origin_protocol = startswith(var.origin_url, "https://") ? "https-only" : "http-only"
}

# ─── CloudFront Distribution ────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = "${var.project_name}-${var.environment}-webapp"
  price_class         = var.price_class
  wait_for_deployment = false # Don't block terraform apply for 15-30min propagation

  origin {
    domain_name = local.origin_domain
    origin_id   = "webapp"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = local.origin_protocol
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behavior — no caching (SSR pages, API routes, dynamic content).
  # All request details are forwarded to the origin so NestJS/Next.js sees
  # the full request (cookies for auth, query strings for pagination, etc).
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "webapp"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # AWS managed policies — CachingDisabled + AllViewerExceptHostHeader
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Next.js static assets have content-hashed filenames — cache aggressively.
  ordered_cache_behavior {
    path_pattern           = "_next/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "webapp"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # AWS managed policy — CachingOptimized (TTL up to 1 year, honor Cache-Control)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # When adding a custom domain, replace with:
    # acm_certificate_arn      = var.acm_certificate_arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-webapp"
  })
}
