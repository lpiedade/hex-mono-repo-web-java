resource "kubernetes_namespace" "app" {
  metadata {
    name = local.namespace

    labels = {
      "app.kubernetes.io/part-of" = local.infra.project
    }
  }

  # A namespace is not what the load balancer controller's webhook rejects -
  # the Services inside it are (see the note at the top of addons.tf). Every
  # Service here names this namespace, so ordering the namespace after the
  # controller orders all of them, in one place.
  depends_on = [helm_release.load_balancer_controller]
}

resource "helm_release" "platform_secrets" {
  name      = "platform-secrets"
  chart     = "${path.module}/charts/platform-secrets"
  namespace = kubernetes_namespace.app.metadata[0].name

  values = [yamlencode({
    region          = local.region
    ssmPrefix       = local.infra.ssm_prefix
    secretStoreName = "${local.name_prefix}-ssm"
    secretName      = local.app_secret_name
    refreshInterval = "1h"
  })]

  # The CRDs have to exist before the chart's objects can be created.
  depends_on = [helm_release.external_secrets]
}
