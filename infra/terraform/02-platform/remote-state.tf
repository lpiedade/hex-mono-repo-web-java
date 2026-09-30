data "terraform_remote_state" "infra" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "01-infra/terraform.tfstate"
    region = var.region
  }
}

locals {
  infra = data.terraform_remote_state.infra.outputs

  region      = local.infra.region
  name_prefix = local.infra.name_prefix

  cluster_name     = local.infra.cluster_name
  cluster_endpoint = local.infra.cluster_endpoint
  cluster_ca       = local.infra.cluster_certificate_authority_data

  db_address         = local.infra.db_address
  db_port            = local.infra.db_port
  db_master_username = local.infra.db_master_username

  ecr = local.infra.ecr_repository_urls
}

# Read with decryption so the `postgresql` provider can authenticate and the
# application role can be created with the password 01-infra generated. This
# puts both values into 02-platform's state as well - same caveat, same
# mitigation (encrypted, closed bucket).
data "aws_ssm_parameter" "db_master_password" {
  name            = "${local.infra.ssm_prefix}/db/master-password"
  with_decryption = true
}

data "aws_ssm_parameter" "db_app_password" {
  name            = "${local.infra.ssm_prefix}/db/app-password"
  with_decryption = true
}
