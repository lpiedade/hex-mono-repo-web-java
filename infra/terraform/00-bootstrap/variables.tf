variable "project" {
  description = "Project slug. Prefixes every resource name across the three stacks, together with `environment`."
  type        = string
  default     = "app"
}

variable "environment" {
  description = "Environment name (dev, staging, prod, ...). Part of every resource name."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region for the state bucket. Keep it equal to the region of the other two stacks."
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = <<-EOT
    Name of the S3 bucket that stores the state of 01-infra and 02-platform.
    Null derives `<project>-<environment>-tfstate-<account-id>`, which is
    globally unique without anyone having to pick a name.
  EOT
  type        = string
  default     = null
}

variable "manage_public_access_block" {
  description = <<-EOT
    Declare Block Public Access on the bucket from Terraform.

    Leave it true unless the account enforces Block Public Access centrally
    and denies `s3:PutBucketPublicAccessBlock` (a common service control
    policy in managed landing zones), in which case the bucket is blocked by
    inheritance and requesting the resource only fails the apply. Check with:

      aws s3control get-public-access-block \
        --account-id $(aws sts get-caller-identity --query Account --output text)

    Four `true`s and a denial on the apply: set false.
  EOT
  type        = bool
  default     = true
}

variable "extra_tags" {
  description = "Tags merged on top of the defaults - cost centre, owner, whatever the account requires."
  type        = map(string)
  default     = {}
}
