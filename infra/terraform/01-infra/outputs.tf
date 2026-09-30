output "project" {
  value = var.project
}

output "environment" {
  value = var.environment
}

output "name_prefix" {
  description = "`<project>-<environment>`, the prefix of every resource name."
  value       = local.name
}

output "region" {
  value = var.region
}

output "tags" {
  description = "Default tags, reused by 02-platform."
  value       = local.tags
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnets" {
  value = module.vpc.private_subnets
}

output "public_subnets" {
  value = module.vpc.public_subnets
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  value = module.eks.cluster_certificate_authority_data
}

output "oidc_provider_arn" {
  value = module.eks.oidc_provider_arn
}

output "node_security_group_id" {
  value = module.eks.node_security_group_id
}

output "irsa_role_arns" {
  description = "Role ARNs 02-platform annotates onto the add-on service accounts."
  value = {
    load_balancer_controller = module.irsa_load_balancer_controller.iam_role_arn
    external_secrets         = module.irsa_external_secrets.iam_role_arn
    fluent_bit               = module.irsa_fluent_bit.iam_role_arn
  }
}

output "container_log_group" {
  value = aws_cloudwatch_log_group.containers.name
}

output "ecr_repository_urls" {
  description = "Push targets for infra/scripts/build-and-push.sh."
  value       = { for k, v in aws_ecr_repository.images : k => v.repository_url }
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_address" {
  value = aws_db_instance.main.address
}

output "db_port" {
  value = aws_db_instance.main.port
}

output "db_master_username" {
  value = aws_db_instance.main.username
}

output "ssm_prefix" {
  description = "Root of the parameter tree holding every secret."
  value       = local.ssm_prefix
}

output "ssm_parameter_names" {
  description = "Every parameter, including the two OIDC ones a human must set before applying 02-platform."
  value = merge(
    { for k, v in aws_ssm_parameter.generated : k => v.name },
    { for k, v in aws_ssm_parameter.external : k => v.name },
  )
}

output "spa_bucket" {
  value = aws_s3_bucket.spa.id
}

output "spa_bucket_regional_domain_name" {
  value = aws_s3_bucket.spa.bucket_regional_domain_name
}

output "spa_bucket_arn" {
  value = aws_s3_bucket.spa.arn
}
