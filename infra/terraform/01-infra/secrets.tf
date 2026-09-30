# Every secret the platform needs, in SSM Parameter Store as SecureString
# under one prefix (ADR-025). 02-platform materialises them into Kubernetes
# Secrets through the External Secrets Operator, so no pod manifest carries a
# value.
#
# Two kinds:
#
# - Generated here: the database passwords. Also written to this stack's
#   state in clear text - a property of Terraform, which is why the state
#   bucket is encrypted and closed (00-bootstrap).
#
# - Issued elsewhere: the BFF's OIDC client credentials, which come from the
#   identity provider. Terraform creates each parameter with a placeholder and
#   then ignores its value, so the real one is written by a human and never
#   enters state. Set them before applying 02-platform:
#
#     aws ssm put-parameter --overwrite --type SecureString \
#       --name <ssm_prefix>/oidc/client-id --value '...'
#     aws ssm put-parameter --overwrite --type SecureString \
#       --name <ssm_prefix>/oidc/client-secret --value '...'

# RDS master account. Owns the server; 02-platform uses it to create the
# least-privileged role the application actually connects with.
resource "random_password" "db_master" {
  length  = 32
  special = true
  # RDS rejects '/', '@', '"' and space in a master password.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The application role (APP_DB_PASSWORD).
resource "random_password" "db_app" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  generated_parameters = {
    "db/master-password" = random_password.db_master.result
    "db/app-password"    = random_password.db_app.result
  }

  external_parameters = toset([
    "oidc/client-id",
    "oidc/client-secret",
  ])
}

resource "aws_ssm_parameter" "generated" {
  for_each = local.generated_parameters

  name  = "${local.ssm_prefix}/${each.key}"
  type  = "SecureString"
  value = each.value

  tags = local.tags
}

resource "aws_ssm_parameter" "external" {
  for_each = local.external_parameters

  name  = "${local.ssm_prefix}/${each.key}"
  type  = "SecureString"
  value = "set-me-outside-terraform"

  # The value is written with `aws ssm put-parameter --overwrite`; an apply
  # must never put the placeholder back.
  lifecycle {
    ignore_changes = [value]
  }

  tags = local.tags
}
