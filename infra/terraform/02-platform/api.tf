resource "kubernetes_deployment" "api" {
  metadata {
    name      = local.api_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = { app = local.api_name }
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = { app = local.api_name }
    }

    template {
      metadata {
        labels = { app = local.api_name }
      }

      spec {
        # The image runs as uid/gid 1001 (infra/docker/Dockerfile.api).
        security_context {
          run_as_non_root = true
          run_as_user     = 1001
          run_as_group    = 1001
          fs_group        = 1001
        }

        container {
          name  = "api"
          image = local.images.api

          port {
            name           = "http"
            container_port = 8080
          }

          # `prod` refuses dev-token mode, so a misconfigured deployment fails
          # at startup instead of accepting a shared bearer.
          env {
            name  = "SPRING_PROFILES_ACTIVE"
            value = "prod"
          }

          # Loopback is the committed default. A container has to bind
          # 0.0.0.0 or the kubelet's probe never connects.
          env {
            name  = "APP_SERVER_ADDRESS"
            value = "0.0.0.0"
          }

          env {
            name  = "APP_DB_URL"
            value = local.jdbc_url
          }

          env {
            name  = "APP_DB_USERNAME"
            value = postgresql_role.app.name
          }

          env {
            name = "APP_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = local.app_secret_name
                key  = "APP_DB_PASSWORD"
              }
            }
          }

          # Bearer tokens from the identity provider, roles from one claim
          # (ADR-011).
          env {
            name  = "APP_AUTH_MODE"
            value = "jwt"
          }

          env {
            name  = "APP_AUTH_ISSUER_URI"
            value = var.oidc_issuer_uri
          }

          env {
            name  = "APP_AUTH_ROLES_CLAIM"
            value = var.roles_claim
          }

          # CORS stays off. The browser only ever talks to the CloudFront
          # origin, which is also where the BFF is served from, so there is
          # no cross-origin request to permit (ADR-017, ADR-025).
          env {
            name  = "APP_CORS_ALLOWED_ORIGINS"
            value = ""
          }

          env {
            name  = "APP_LOG_LEVEL"
            value = var.log_level
          }

          resources {
            requests = var.api_resources.requests
            limits   = var.api_resources.limits
          }

          # Liveness is process health only. Readiness additionally requires
          # the database, so a pod stays out of rotation while it is
          # unreachable instead of taking traffic.
          liveness_probe {
            http_get {
              path = "/actuator/health/liveness"
              port = "http"
            }
            period_seconds    = 15
            failure_threshold = 4
          }

          readiness_probe {
            http_get {
              path = "/actuator/health/readiness"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 6
          }

          # Flyway migrates on first boot; a cold start against an empty
          # database takes longer than a warm one. The startup probe holds the
          # other two off until then.
          startup_probe {
            http_get {
              path = "/actuator/health/liveness"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 30
          }
        }
      }
    }
  }

  # Flyway runs on start, so the database and its owner must exist first.
  depends_on = [
    postgresql_grant.app_public_schema,
    helm_release.platform_secrets,
  ]
}

resource "kubernetes_service" "api" {
  metadata {
    name      = local.api_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = { app = local.api_name }
  }

  spec {
    # ClusterIP: the API is not on the ALB. The browser reaches it only
    # through the BFF (ADR-009, ADR-025).
    type     = "ClusterIP"
    selector = { app = local.api_name }

    port {
      name        = "http"
      port        = 8080
      target_port = "http"
    }
  }
}
