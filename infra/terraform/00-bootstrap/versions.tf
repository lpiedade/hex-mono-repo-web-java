# Bootstrap stack: the only stack whose state is local.
#
# It creates the S3 bucket that holds the state of 01-infra and 02-platform.
# That bucket cannot hold its own state before it exists, so this stack keeps
# terraform.tfstate on disk beside these files, is applied once, and is then
# left alone. The file is git-ignored (see ../.gitignore).
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}
