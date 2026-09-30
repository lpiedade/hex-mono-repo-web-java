# CloudFront is the single origin the browser sees (ADR-025). Two origins sit
# behind it - the S3 bucket for the SPA's static assets and the ALB for the
# BFF's server-side routes - so the browser never makes a cross-origin call
# (ADR-017).

resource "aws_cloudfront_origin_access_control" "spa" {
  name                              = "${local.name_prefix}-spa"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "spa_router" {
  name    = "${local.name_prefix}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "SPA shell fallback and base-path redirect (ADR-025)"
  publish = true
  code    = templatefile("${path.module}/spa-router.js", { base = local.base_path })
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Forwards everything the BFF needs — Authorization, cookies, query string —
# except Host, which must stay the ALB's own name for the listener to match.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "portal" {
  enabled         = true
  comment         = "${local.name_prefix} portal"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true
  web_acl_id      = aws_wafv2_web_acl.portal.arn

  origin {
    origin_id                = "spa"
    domain_name              = local.infra.spa_bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.spa.id
  }

  origin {
    origin_id   = "alb"
    domain_name = local.alb_hostname

    custom_origin_config {
      http_port  = 80
      https_port = 443
      # The origin leg is plain HTTP: the ALB has no certificate of its own
      # and is reachable only from the CloudFront prefix list.
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Static SPA. Everything not matched by a behaviour below lands here, and
  # the function decides between the shell, a real asset and a 404.
  default_cache_behavior {
    target_origin_id       = "spa"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # The BFF's three server-side route groups (ADR-017).
  ordered_cache_behavior {
    path_pattern             = "/${local.base_path}/bff/*"
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  ordered_cache_behavior {
    path_pattern             = "/${local.base_path}/health"
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  ordered_cache_behavior {
    path_pattern             = "/${local.base_path}/about"
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # No ACM certificate and no alias: this environment has no domain of its
    # own, so it is served on the distribution's *.cloudfront.net name.
    cloudfront_default_certificate = true
  }

  tags = local.tags
}

# The bucket lives in 01-infra but its policy names this distribution, so the
# policy has to be written here.
data "aws_iam_policy_document" "spa_bucket" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${local.infra.spa_bucket_arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.portal.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "spa" {
  bucket = local.infra.spa_bucket
  policy = data.aws_iam_policy_document.spa_bucket.json
}
