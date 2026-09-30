terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.25"
    }
  }

  # Partial configuration, like 01-infra: `bucket` and `region` come from a
  # git-ignored backend.hcl (see backend.hcl.example):
  #
  #   terraform init -backend-config=backend.hcl
  backend "s3" {
    key          = "02-platform/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = local.region

  default_tags {
    tags = local.tags
  }
}

# A CLOUDFRONT-scoped WAF web ACL only exists in us-east-1, whatever region the
# rest of the environment lives in.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}

# Both Kubernetes providers authenticate by shelling out to the AWS CLI, which
# keeps the token fresh for the whole apply. A static `token` from a data
# source expires after 15 minutes and breaks long applies.
provider "kubernetes" {
  host                   = local.cluster_endpoint
  cluster_ca_certificate = base64decode(local.cluster_ca)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", local.cluster_name, "--region", local.region]
  }
}

provider "helm" {
  kubernetes {
    host                   = local.cluster_endpoint
    cluster_ca_certificate = base64decode(local.cluster_ca)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", local.cluster_name, "--region", local.region]
    }
  }
}

# Connects to the private RDS instance directly, so wherever this stack is
# applied needs a route into the VPC (01-infra's operator_* variables).
provider "postgresql" {
  host      = local.db_address
  port      = local.db_port
  username  = local.db_master_username
  password  = data.aws_ssm_parameter.db_master_password.value
  sslmode   = "require"
  superuser = false
  # RDS never grants true superuser; the master account is rds_superuser.
  # Without this the provider tries `SET ROLE` calls the master cannot make.
  database = "postgres"
}
