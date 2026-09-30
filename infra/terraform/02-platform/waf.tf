# A CLOUDFRONT-scoped web ACL only exists in us-east-1, whatever region the
# rest of the environment is in — hence the aliased provider on every
# resource here.

locals {
  # AWS WAF accepts every IPv4 CIDR except /0, so "allow everything" — which
  # is what the default `allowed_cidrs` means — has to be written as the two
  # halves of the address space. Substituting it here rather than in the
  # variable's default keeps the intent readable in terraform.tfvars.
  waf_allowed_cidrs = flatten([
    for cidr in var.allowed_cidrs :
    cidr == "0.0.0.0/0" ? ["0.0.0.0/1", "128.0.0.0/1"] : [cidr]
  ])

  # The same rejection applies to ::/0, and the same trick answers it.
  waf_allowed_cidrs_v6 = flatten([
    for cidr in var.allowed_cidrs_v6 :
    cidr == "::/0" ? ["::/1", "8000::/1"] : [cidr]
  ])
}

resource "aws_wafv2_ip_set" "allowed" {
  provider = aws.us_east_1

  name               = "${local.name_prefix}-allowed"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = local.waf_allowed_cidrs

  tags = local.tags
}

# An IP set carries one address family, so admitting IPv6 takes a second set
# rather than more entries in the one above. Leaving it out is what made the
# portal 403 from cellular networks while working from IPv4 offices: the
# distribution publishes AAAA records, a phone prefers them, and no allow
# rule could ever match the resulting source address.
resource "aws_wafv2_ip_set" "allowed_v6" {
  provider = aws.us_east_1

  name               = "${local.name_prefix}-allowed-v6"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV6"
  addresses          = local.waf_allowed_cidrs_v6

  tags = local.tags
}

resource "aws_wafv2_web_acl" "portal" {
  provider = aws.us_east_1

  name  = "${local.name_prefix}-portal"
  scope = "CLOUDFRONT"

  # Default block, allow by rule. With the defaults of 0.0.0.0/0 and ::/0 the
  # two IP rules between them match every address and the ACL filters
  # nothing — that is the documented, deliberate starting point, not an
  # oversight. It only holds while both families are covered; narrowing one
  # list and forgetting the other silently blocks that whole family.
  default_action {
    block {}
  }

  # Priority 1 so it is evaluated before the allow: an allow terminates
  # evaluation, and a request from a permitted address should still not be
  # allowed to carry an obvious injection payload.
  rule {
    name     = "aws-common-rules"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # The two allow rules are an OR written as two rules: an allow terminates
  # evaluation, so a viewer admitted by either family never reaches the
  # other. Kept as separate rules rather than one or_statement because that
  # is the shape the console's rule builder produces, and an emergency fix
  # made by hand there should read as the same thing this file declares.
  rule {
    name     = "allowed-cidrs"
    priority = 2

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.allowed.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-allowed-cidrs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "allowed-cidrs-v6"
    priority = 3

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.allowed_v6.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-allowed-cidrs-v6"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-portal"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}
