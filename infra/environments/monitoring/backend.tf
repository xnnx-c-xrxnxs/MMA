terraform {
  required_version = ">= 1.6.0"

  # Uses the MAIN project tfstate bucket (created by bootstrap) — NOT a
  # separate monitoring bucket. State isolation via S3 key prefix.
  # Configured via -backend-config in CI:
  #   -backend-config="bucket={project}-tfstate"
  #   -backend-config="key=monitoring/{environment}/terraform.tfstate"
  #   -backend-config="region={aws_region}"
  #   -backend-config="dynamodb_table={project}-tflock"
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}
