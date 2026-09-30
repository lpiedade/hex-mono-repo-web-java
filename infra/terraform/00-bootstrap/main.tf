data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"

  bucket_name = coalesce(
    var.state_bucket_name,
    "${local.name}-tfstate-${data.aws_caller_identity.current.account_id}"
  )

  tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "00-bootstrap"
    },
    var.extra_tags,
  )
}

resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name

  # The state of the other two stacks describes the whole environment; losing
  # it means adopting every resource by hand. Deletion stays blocked until
  # someone removes this line deliberately.
  lifecycle {
    prevent_destroy = true
  }
}

# Versioning is what makes a corrupted or truncated state recoverable, and it
# is also what the S3 native lock relies on to keep the lock object tidy.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# The state carries database passwords in clear text (a known Terraform
# property, not something a provider can fix), so the bucket is encrypted and
# closed to the public without exception.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  count = var.manage_public_access_block ? 1 : 0

  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# No DynamoDB table: since Terraform 1.10 the S3 backend locks through a
# `.tflock` object in this same bucket (`use_lockfile = true` in the backend
# blocks of 01-infra and 02-platform).
