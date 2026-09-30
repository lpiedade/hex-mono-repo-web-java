data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"

  tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "01-infra"
    },
    var.extra_tags,
  )

  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # /20 per subnet out of a /16: 4,094 usable addresses each, which is what
  # the VPC CNI wants when every pod takes an ENI address.
  private_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  public_subnets  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 8)]

  operator_peering_enabled = var.operator_vpc_id != null

  # The images build-and-push.sh publishes. There is no SPA image here: on AWS
  # the SPA is static objects in S3 behind CloudFront (ADR-025).
  ecr_repositories = toset(["api", "portal-bff"])

  ssm_prefix = "/${local.name}"
}
