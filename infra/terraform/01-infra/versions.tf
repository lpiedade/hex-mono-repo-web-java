terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Partial configuration: `bucket` and `region` come from backend.hcl, which
  # 00-bootstrap's `backend_hcl` output prints and which is git-ignored:
  #
  #   terraform init -backend-config=backend.hcl
  #
  # A backend block cannot read variables, so this is the one way to keep an
  # environment-specific bucket name out of the committed code.
  # `use_lockfile` is the S3 native lock (Terraform >= 1.10).
  backend "s3" {
    key          = "01-infra/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}
