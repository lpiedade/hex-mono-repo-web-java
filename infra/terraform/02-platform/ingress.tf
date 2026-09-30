# AWS publishes the addresses its CloudFront edges use to reach an origin as a
# managed prefix list. Pinning the ALB's security group to it means nothing
# but CloudFront can open a connection, so the WAF at the edge cannot be
# bypassed by resolving the ALB hostname directly.
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name = "${local.name_prefix}-alb"
  # ASCII only. EC2 rejects a GroupDescription with any character outside it
  # ("Character sets beyond ASCII are not supported"), which an em dash is.
  description = "Portal ALB - reachable from CloudFront only"
  vpc_id      = local.infra.vpc_id

  tags = merge(local.tags, { Name = "${local.name_prefix}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id

  description    = "HTTP from CloudFront edges"
  ip_protocol    = "tcp"
  from_port      = 80
  to_port        = 80
  prefix_list_id = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
}

resource "aws_vpc_security_group_egress_rule" "alb_to_anywhere" {
  security_group_id = aws_security_group.alb.id

  description = "To the BFF pods"
  ip_protocol = "-1"
  cidr_ipv4   = "0.0.0.0/0"
}

resource "kubernetes_ingress_v1" "portal" {
  metadata {
    name      = "portal"
    namespace = kubernetes_namespace.app.metadata[0].name

    annotations = {
      "alb.ingress.kubernetes.io/scheme"       = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"  = "ip"
      "alb.ingress.kubernetes.io/listen-ports" = jsonencode([{ HTTP = 80 }])

      # TLS terminates at CloudFront on its default *.cloudfront.net
      # certificate; the origin leg is plain HTTP inside the VPC, reachable
      # only from the prefix list above. Put ACM on this listener the day the
      # environment gets a domain of its own.
      "alb.ingress.kubernetes.io/security-groups"                     = aws_security_group.alb.id
      "alb.ingress.kubernetes.io/manage-backend-security-group-rules" = "true"

      "alb.ingress.kubernetes.io/healthcheck-path"     = "/${local.base_path}/health"
      "alb.ingress.kubernetes.io/healthcheck-protocol" = "HTTP"
      "alb.ingress.kubernetes.io/load-balancer-name"   = "${local.name_prefix}-portal"
      "alb.ingress.kubernetes.io/tags"                 = join(",", [for k, v in local.tags : "${k}=${v}"])
    }
  }

  spec {
    ingress_class_name = "alb"

    # The BFF's three server-side route groups (ADR-017). Everything else
    # under the base path is a static asset and never reaches the ALB -
    # CloudFront serves it from S3.
    rule {
      http {
        path {
          path      = "/${local.base_path}/bff"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.bff.metadata[0].name
              port { number = 8081 }
            }
          }
        }

        path {
          path      = "/${local.base_path}/health"
          path_type = "Exact"

          backend {
            service {
              name = kubernetes_service.bff.metadata[0].name
              port { number = 8081 }
            }
          }
        }

        path {
          path      = "/${local.base_path}/about"
          path_type = "Exact"

          backend {
            service {
              name = kubernetes_service.bff.metadata[0].name
              port { number = 8081 }
            }
          }
        }
      }
    }
  }

  # The CloudFront distribution takes this ALB's hostname as an origin, so the
  # apply has to block until the controller has actually provisioned it.
  wait_for_load_balancer = true

  depends_on = [helm_release.load_balancer_controller]
}

locals {
  alb_hostname = kubernetes_ingress_v1.portal.status[0].load_balancer[0].ingress[0].hostname
}
