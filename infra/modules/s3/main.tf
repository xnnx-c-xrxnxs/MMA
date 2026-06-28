# ─── S3 Bucket Module ────────────────────────────────────────────────────────
# Creates a single S3 bucket with encryption and optional versioning.
# Called via for_each — one invocation per registry s3Bucket.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = merge(var.tags, {
    Name = var.bucket_name
  })
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── CORS Configuration (conditional — for browser-based uploads) ───────────

resource "aws_s3_bucket_cors_configuration" "this" {
  count  = length(var.cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }
}

# ─── Lifecycle Rules (conditional) ──────────────────────────────────────────

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  count  = var.lifecycle_expiration_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "expire-old-objects"
    status = "Enabled"

    filter {}

    expiration {
      days = var.lifecycle_expiration_days
    }
  }
}
