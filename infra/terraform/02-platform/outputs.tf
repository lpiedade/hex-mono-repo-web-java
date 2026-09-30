output "portal_url" {
  description = "Where the portal is served."
  value       = local.portal_url
}

output "oidc_redirect_uri" {
  description = "Register this as a redirect URI of the BFF's client at the identity provider."
  value       = local.oidc_redirect_uri
}

output "cloudfront_distribution_id" {
  description = "Needed by build-and-push.sh to invalidate the shell after a deploy."
  value       = aws_cloudfront_distribution.portal.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.portal.domain_name
}

output "alb_hostname" {
  description = "Origin of the BFF behaviours. Not reachable except from CloudFront."
  value       = local.alb_hostname
}

output "namespace" {
  value = kubernetes_namespace.app.metadata[0].name
}

output "deployed_image_tag" {
  value = var.image_tag
}
