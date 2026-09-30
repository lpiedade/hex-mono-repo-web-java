resource "kubernetes_deployment" "bff" {
  metadata {
    name      = local.bff_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = { app = local.bff_name }
  }

  spec {
    replicas = var.bff_replicas

    selector {
      match_labels = { app = local.bff_name }
    }

    template {
      metadata {
        labels = { app = local.bff_name }
      }

      spec {
        # The image runs as uid/gid 1001 (infra/docker/Dockerfile.portal-bff).
        security_context {
          run_as_non_root = true
          run_as_user     = 1001
          run_as_group    = 1001
        }

        container {
          name  = "bff"
          image = local.images.portal_bff

          port {
            name           = "http"
            container_port = 8081
          }

          env {
            name  = "SPRING_PROFILES_ACTIVE"
            value = "prod"
          }

          # Cluster-internal name of the API Service. The BFF is a transparent
          # proxy and appends /api/v1/... to this root.
          env {
            name  = "APP_BFF_API_BASE_URL"
            value = "http://${kubernetes_service.api.metadata[0].name}.${local.namespace}.svc.cluster.local:8080"
          }

          # The authorization-code login against the identity provider, with
          # the tokens kept in the server-side session (ADR-010).
          env {
            name  = "APP_BFF_AUTH_MODE"
            value = "oidc"
          }

          env {
            name  = "APP_OIDC_ISSUER_URI"
            value = var.oidc_issuer_uri
          }

          # CloudFront forwards the ALB's host name, not the public one, so the
          # BFF is told the public origin explicitly; otherwise the OIDC callback
          # URL it sends to the identity provider points at the internal host.
          env {
            name  = "APP_BFF_PUBLIC_BASE_URL"
            value = "https://${aws_cloudfront_distribution.portal.domain_name}"
          }

          env {
            name = "APP_OIDC_CLIENT_ID"
            value_from {
              secret_key_ref {
                name = local.app_secret_name
                key  = "APP_OIDC_CLIENT_ID"
              }
            }
          }

          env {
            name = "APP_OIDC_CLIENT_SECRET"
            value_from {
              secret_key_ref {
                name = local.app_secret_name
                key  = "APP_OIDC_CLIENT_SECRET"
              }
            }
          }

          env {
            name  = "APP_LOG_LEVEL"
            value = var.log_level
          }

          resources {
            requests = var.bff_resources.requests
            limits   = var.bff_resources.limits
          }

          # The BFF's own health endpoint - the same one the ALB target group
          # checks (ingress.tf).
          liveness_probe {
            http_get {
              path = "/${local.base_path}/health"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 15
          }

          readiness_probe {
            http_get {
              path = "/${local.base_path}/health"
              port = "http"
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [helm_release.platform_secrets]
}

resource "kubernetes_service" "bff" {
  metadata {
    name      = local.bff_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = { app = local.bff_name }
  }

  spec {
    # ClusterIP is enough: the Ingress uses `target-type: ip`, so the ALB
    # registers the pod addresses the VPC CNI hands out and never needs a
    # node port.
    type     = "ClusterIP"
    selector = { app = local.bff_name }

    port {
      name        = "http"
      port        = 8081
      target_port = "http"
    }
  }
}
