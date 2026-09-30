locals {
  tags = merge(
    local.infra.tags,
    { Stack = "02-platform" },
    var.extra_tags,
  )

  namespace = var.namespace

  # The SPA's base path, without slashes. Must equal `base` in
  # portal/web/vite.config.ts and APP_BASE_PATH in build-and-push.sh (default
  # `app`): the bucket keys, the CloudFront behaviours, the Ingress paths and
  # the BFF's own routes are all under it.
  base_path = "app"

  # Service names, used by the Kubernetes Services and by the URLs the pods
  # are handed.
  api_name = "api"
  bff_name = "bff"

  images = {
    api        = "${local.ecr["api"]}:${var.image_tag}"
    portal_bff = "${local.ecr["portal-bff"]}:${var.image_tag}"
  }

  # The Kubernetes Secret the External Secrets Operator materialises from SSM.
  app_secret_name = "app-secrets"

  # The database and the role the API connects with (database.tf).
  db_name = "app"
  db_role = "app"

  jdbc_url = "jdbc:postgresql://${local.db_address}:${local.db_port}/${local.db_name}"

  # Where the browser reaches the portal, and the OIDC callback the BFF
  # serves under it (ADR-010, ADR-017). Register the redirect URI with the
  # identity provider.
  portal_url        = "https://${aws_cloudfront_distribution.portal.domain_name}/${local.base_path}/"
  oidc_redirect_uri = "https://${aws_cloudfront_distribution.portal.domain_name}/${local.base_path}/bff/login/oauth2/code/oidc"
}
