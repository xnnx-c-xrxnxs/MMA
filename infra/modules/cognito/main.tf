# ─── Cognito Module ──────────────────────────────────────────────────────────
# Creates a Cognito User Pool and App Client for authentication.
# One invocation per environment — not iterated via for_each.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-${var.environment}"

  # Username = email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Custom attributes required by the auth provider
  schema {
    name                = "userId"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "userRole"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  # Password policy
  password_policy {
    minimum_length                   = var.password_min_length
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = var.temporary_password_validity_days
  }

  # Account recovery — email only
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Use Cognito default email (SES can be configured later)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Allow admin to create users (AdminCreateUser flow)
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  deletion_protection = var.deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}"
  })
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.project_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  # Auth flows matching CognitoAuthProvider usage
  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # No client secret — AdminInitiateAuthCommand doesn't use one
  generate_secret = false

  # Token validity
  access_token_validity  = var.access_token_validity_minutes
  id_token_validity      = var.id_token_validity_minutes
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read/write custom attributes
  read_attributes  = ["email", "email_verified", "custom:userId", "custom:userRole"]
  write_attributes = ["email", "custom:userId", "custom:userRole"]
}
