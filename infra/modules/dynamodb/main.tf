# ─── DynamoDB Module ─────────────────────────────────────────────────────────
# Creates a single DynamoDB table with PAY_PER_REQUEST billing.
# Called via for_each in the environment root — one invocation per registry table.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

# ─── Primary Table ───────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "this" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Dynamically create attributes referenced by GSIs
  dynamic "attribute" {
    for_each = { for attr in local.gsi_attributes : attr.name => attr.type }
    content {
      name = attribute.key
      type = attribute.value
    }
  }

  # Dynamically create GSIs from registry config
  dynamic "global_secondary_index" {
    for_each = { for gsi in var.gsis : gsi.indexName => gsi }
    content {
      name            = global_secondary_index.value.indexName
      hash_key        = global_secondary_index.value.hashKey
      range_key       = try(global_secondary_index.value.sortKey, null)
      projection_type = "ALL"
    }
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = merge(var.tags, {
    Name   = var.table_name
    Domain = var.domain
  })
}

# ─── Locals ─────────────────────────────────────────────────────────────────

locals {
  # Collect all unique attributes referenced by GSIs (hash + sort keys)
  # Exclude PK and SK since they are already defined on the table
  gsi_attributes = distinct(flatten([
    for gsi in var.gsis : concat(
      # Hash key attribute
      gsi.hashKey != "PK" && gsi.hashKey != "SK" ? [
        { name = gsi.hashKey, type = try(gsi.hashKeyType, "S") }
      ] : [],
      # Sort key attribute (if present)
      try(gsi.sortKey, null) != null && try(gsi.sortKey, "PK") != "PK" && try(gsi.sortKey, "SK") != "SK" ? [
        { name = gsi.sortKey, type = try(gsi.sortKeyType, "S") }
      ] : []
    )
  ]))
}
