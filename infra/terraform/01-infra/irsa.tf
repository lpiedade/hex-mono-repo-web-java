# IAM roles for the three cluster add-ons 02-platform installs. They live here
# because they are bound to the OIDC provider this stack creates; 02-platform
# only annotates the service accounts with the ARNs exported below.

module "irsa_load_balancer_controller" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.44"

  role_name                              = "${local.name}-alb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.tags
}

module "irsa_external_secrets" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.44"

  role_name                      = "${local.name}-external-secrets"
  attach_external_secrets_policy = true

  # Scoped to this environment's parameter tree, not to the account's.
  external_secrets_ssm_parameter_arns = [
    "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_prefix}/*"
  ]

  # Every secret here is an SSM SecureString, so the Secrets Manager half of
  # this policy should grant nothing. It cannot be an empty list - the
  # module's Secrets Manager statement is not wrapped in a `dynamic` block, so
  # `[]` emits a statement with no resources and IAM rejects the policy - and
  # it cannot be omitted, because the module then defaults to every secret in
  # the account. So it names a path under this environment's prefix that
  # nothing ever writes: a valid ARN that grants access to nothing.
  external_secrets_secrets_manager_arns = [
    "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${local.name}/unused-*"
  ]

  external_secrets_kms_key_arns = ["arn:aws:kms:${var.region}:${data.aws_caller_identity.current.account_id}:key/*"]

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets"]
    }
  }

  tags = local.tags
}

# Fluent Bit ships every pod's stdout to CloudWatch Logs. The logs carry
# %X{correlationId} (ADR-016), so a Logs Insights filter on that field follows
# one request across the BFF and the API.
resource "aws_cloudwatch_log_group" "containers" {
  name              = "/aws/eks/${local.name}/containers"
  retention_in_days = 30

  tags = local.tags
}

data "aws_iam_policy_document" "fluent_bit" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:CreateLogGroup",
      "logs:DescribeLogStreams",
      "logs:DescribeLogGroups",
      "logs:PutLogEvents",
      "logs:PutRetentionPolicy",
    ]
    resources = ["${aws_cloudwatch_log_group.containers.arn}:*"]
  }
}

resource "aws_iam_policy" "fluent_bit" {
  name   = "${local.name}-fluent-bit"
  policy = data.aws_iam_policy_document.fluent_bit.json
  tags   = local.tags
}

module "irsa_fluent_bit" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.44"

  role_name = "${local.name}-fluent-bit"

  role_policy_arns = {
    logs = aws_iam_policy.fluent_bit.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["amazon-cloudwatch:aws-for-fluent-bit"]
    }
  }

  tags = local.tags
}
