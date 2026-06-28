terraform {
  required_version = ">= 1.6.0"

  # Backend configured via -backend-config in CI
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}
