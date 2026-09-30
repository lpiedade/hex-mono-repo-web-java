# Bucket holding the built SPA (ADR-025). The objects live under the key prefix
# that mirrors the SPA's base path (`app/` for Vite's `base: "/app/"`), so
# every asset URL the shell emits resolves to a key as-is.
#
# The bucket is private and has no website configuration. CloudFront reaches it
# through an Origin Access Control, which requires the REST endpoint - the
# website endpoint only speaks HTTP and cannot be OAC-signed.
#
# The distribution, its bucket policy and the WAF web ACL are in 02-platform:
# the distribution needs the ALB as its second origin, and the ALB does not
# exist until the Ingress is created there.

resource "aws_s3_bucket" "spa" {
  bucket = "${local.name}-spa-${data.aws_caller_identity.current.account_id}"

  # The bucket holds build output only; build-and-push.sh re-uploads it.
  force_destroy = true

  tags = local.tags
}

resource "aws_s3_bucket_public_access_block" "spa" {
  count = var.manage_public_access_block ? 1 : 0

  bucket = aws_s3_bucket.spa.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "spa" {
  bucket = aws_s3_bucket.spa.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Hashed bundles under app/assets/ are content-addressed and immutable; the
# shell is not. Cache-Control is set per object by build-and-push.sh
# (`aws s3 sync`), not here - S3 cannot express it as bucket configuration.
