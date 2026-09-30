variable "state_bucket" {
  description = <<-EOT
    Bucket holding 01-infra's state, read by the `terraform_remote_state` data
    source - the same bucket backend.hcl names (00-bootstrap's `state_bucket`
    output). A backend is configured once at `init`; a variable is resolved on
    every run, so set it in terraform.tfvars.
  EOT
  type        = string
}

variable "region" {
  description = "Region of the state bucket. The deployment region itself is read from 01-infra."
  type        = string
  default     = "us-east-1"
}

variable "namespace" {
  description = "Kubernetes namespace for the application workloads."
  type        = string
  default     = "app"
}

variable "image_tag" {
  description = <<-EOT
    Tag of the API and BFF images to deploy - the git sha printed by
    infra/scripts/build-and-push.sh. Deliberately not `latest`: a rollback
    should be a change to this value, reviewable in a plan.
  EOT
  type        = string
}

variable "extra_tags" {
  description = "Tags merged on top of 01-infra's."
  type        = map(string)
  default     = {}
}

# -- Identity -----------------------------------------------------------------

variable "oidc_issuer_uri" {
  description = <<-EOT
    Issuer of the identity provider. The BFF runs its OIDC login against it
    (APP_OIDC_ISSUER_URI) and the API validates the bearer tokens it issued
    (APP_AUTH_ISSUER_URI). The client id and secret are not variables: they
    live in SSM, set by a human (see 01-infra's secrets.tf).
  EOT
  type        = string
}

variable "roles_claim" {
  description = "Token claim that carries the user's roles (APP_AUTH_ROLES_CLAIM)."
  type        = string
  default     = "roles"
}

# -- Access control -----------------------------------------------------------

variable "allowed_cidrs" {
  description = <<-EOT
    IPv4 CIDRs the WAF web ACL admits at the CloudFront edge. The default
    filters nothing. IPv6 viewers are governed by allowed_cidrs_v6: a WAFv2 IP
    set holds one address family, so narrowing only this list leaves IPv6
    wide open.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_cidrs_v6" {
  description = <<-EOT
    IPv6 CIDRs the WAF web ACL admits. The distribution enables IPv6, so it
    publishes AAAA records and mobile networks reach it over IPv6 by
    preference. An empty list admits no IPv6 viewer at all.
  EOT
  type        = list(string)
  default     = ["::/0"]
}

# -- Application --------------------------------------------------------------

variable "api_replicas" {
  description = "Replicas of the API deployment. The API is stateless; Flyway serialises concurrent migrations with a lock."
  type        = number
  default     = 2
}

variable "bff_replicas" {
  description = <<-EOT
    Replicas of the portal BFF. One by default because the BFF keeps sessions
    in memory (ADR-010): a second replica needs ALB session stickiness or
    Spring Session first, or users are logged out at random.
  EOT
  type        = number
  default     = 1
}

variable "api_resources" {
  description = "Requests and limits for the API container."
  type = object({
    requests = object({ cpu = string, memory = string })
    limits   = object({ cpu = string, memory = string })
  })
  default = {
    requests = { cpu = "250m", memory = "512Mi" }
    limits   = { cpu = "1", memory = "1Gi" }
  }
}

variable "bff_resources" {
  description = "Requests and limits for the BFF container."
  type = object({
    requests = object({ cpu = string, memory = string })
    limits   = object({ cpu = string, memory = string })
  })
  default = {
    requests = { cpu = "200m", memory = "384Mi" }
    limits   = { cpu = "1", memory = "768Mi" }
  }
}

variable "log_level" {
  description = "Root log level for the API and the BFF (APP_LOG_LEVEL)."
  type        = string
  default     = "INFO"
}

# -- Add-on chart versions ----------------------------------------------------

variable "chart_versions" {
  description = "Pinned chart versions for the three add-ons."
  type = object({
    load_balancer_controller = string
    external_secrets         = string
    fluent_bit               = string
  })
  default = {
    load_balancer_controller = "1.10.1"
    external_secrets         = "0.12.1"
    fluent_bit               = "0.1.34"
  }
}
