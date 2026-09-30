# Three cluster add-ons, each bound to an IAM role created in 01-infra.
#
# THE LOAD BALANCER CONTROLLER MUST FINISH FIRST, and everything that creates
# a Service has to say so explicitly.
#
# Its chart registers a mutating admission webhook on Services
# (`mservice.elbv2.k8s.aws`) with a failure policy of Fail. From the moment
# that webhook is registered until its pods have endpoints, the API server
# rejects *every* Service creation in the cluster with
#
#   Internal error occurred: failed calling webhook "mservice.elbv2.k8s.aws":
#   no endpoints available for service "aws-load-balancer-webhook-service"
#
# Nothing in the resource graph expresses that: the three releases share no
# attribute, so Terraform installs them in parallel and whichever chart
# creates a Service during that window fails. Hence the `depends_on` below —
# they encode an ordering the providers cannot infer.

# Turns the Ingress below into an ALB.
resource "helm_release" "load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = var.chart_versions.load_balancer_controller
  namespace  = "kube-system"

  # Load-bearing, not decoration: without waiting for the controller's pods
  # to be ready, this resource completes while the webhook it just registered
  # still has no endpoints, and the dependants below fail anyway.
  wait    = true
  timeout = 600

  set {
    name  = "clusterName"
    value = local.cluster_name
  }

  set {
    name  = "region"
    value = local.region
  }

  set {
    name  = "vpcId"
    value = local.infra.vpc_id
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = local.infra.irsa_role_arns.load_balancer_controller
  }
}

# Materialises the SSM parameters as Kubernetes Secrets.
resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = "external-secrets"
  }
}

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = var.chart_versions.external_secrets
  namespace  = kubernetes_namespace.external_secrets.metadata[0].name

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "external-secrets"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = local.infra.irsa_role_arns.external_secrets
  }

  # The chart creates Services, which the load balancer controller's webhook
  # rejects until that controller has endpoints. See the note at the top.
  depends_on = [helm_release.load_balancer_controller]
}

# Ships every pod's stdout to the CloudWatch log group 01-infra created. The
# lines already carry %X{correlationId} (ADR-016), so one request can be
# followed across the BFF and the API in Logs Insights.
resource "kubernetes_namespace" "cloudwatch" {
  metadata {
    name = "amazon-cloudwatch"
  }
}

resource "helm_release" "fluent_bit" {
  name       = "aws-for-fluent-bit"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-for-fluent-bit"
  version    = var.chart_versions.fluent_bit
  namespace  = kubernetes_namespace.cloudwatch.metadata[0].name

  set {
    name  = "serviceAccount.name"
    value = "aws-for-fluent-bit"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = local.infra.irsa_role_arns.fluent_bit
  }

  set {
    name  = "cloudWatchLogs.enabled"
    value = "true"
  }

  set {
    name  = "cloudWatchLogs.region"
    value = local.region
  }

  set {
    name  = "cloudWatchLogs.logGroupName"
    value = local.infra.container_log_group
  }

  set {
    name  = "cloudWatchLogs.autoCreateGroup"
    value = "false"
  }

  # Only the three back ends this environment has. Left at their defaults the
  # chart also enables Firehose, Kinesis and OpenSearch outputs that have no
  # destination here and log a connection error per flush.
  set {
    name  = "firehose.enabled"
    value = "false"
  }

  set {
    name  = "kinesis.enabled"
    value = "false"
  }

  set {
    name  = "elasticsearch.enabled"
    value = "false"
  }

  # Same reason as external-secrets above.
  depends_on = [helm_release.load_balancer_controller]
}
