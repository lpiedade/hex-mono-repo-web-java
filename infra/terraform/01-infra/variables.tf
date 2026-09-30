variable "project" {
  description = "Project slug. Keep it equal to 00-bootstrap's."
  type        = string
  default     = "app"
}

variable "environment" {
  description = "Environment name. Keep it equal to 00-bootstrap's."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region. Must match the region of the state bucket."
  type        = string
  default     = "us-east-1"
}

variable "extra_tags" {
  description = "Tags merged on top of the defaults - cost centre, owner, whatever the account requires."
  type        = map(string)
  default     = {}
}

variable "manage_public_access_block" {
  description = <<-EOT
    Declare Block Public Access on the SPA bucket from Terraform. Same reasoning
    as the identical variable in 00-bootstrap: set false only in an account
    that enforces it centrally and denies `s3:PutBucketPublicAccessBlock`.

    The CloudFront origin access control in 02-platform is unaffected either
    way: its bucket policy grants `s3:GetObject` to the CloudFront service
    principal under an `AWS:SourceArn` condition, which is not a public policy.
  EOT
  type        = bool
  default     = true
}

# -- Network ------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR of the VPC this stack creates. Must not overlap operator_vpc_cidr when peering is used."
  type        = string
  default     = "10.42.0.0/16"
}

variable "az_count" {
  description = "How many availability zones to spread the subnets across."
  type        = number
  default     = 3
}

variable "single_nat_gateway" {
  description = <<-EOT
    One NAT gateway for the whole VPC instead of one per AZ. A NAT gateway per
    AZ is the single largest fixed cost of a small EKS environment; set false
    for production, where losing one AZ must not cut egress for the others.
  EOT
  type        = bool
  default     = true
}

# -- Operator network access (optional) ---------------------------------------
#
# 02-platform creates the application database role through the `postgresql`
# provider, which connects to the private RDS instance directly. Wherever
# Terraform runs therefore needs a route to this VPC. These variables peer an
# existing VPC that hosts the operator workstation or the CI runner (same
# account and region). Leave operator_vpc_id null when the route exists some
# other way (VPN, Direct Connect, a runner inside this VPC) - then only
# operator_cidr_blocks is needed, to open the database security group.

variable "operator_vpc_id" {
  description = "VPC to peer with this one so Terraform can reach RDS. Null disables peering."
  type        = string
  default     = null
}

variable "operator_vpc_cidr" {
  description = "CIDR of operator_vpc_id. Required when it is set - it is the destination of the return route."
  type        = string
  default     = null
}

variable "operator_route_table_ids" {
  description = "Route tables in operator_vpc_id that need a route to this VPC. Empty means you add the route by hand."
  type        = list(string)
  default     = []
}

variable "operator_security_group_id" {
  description = "Security group of the operator instance. When set, RDS admits 5432 from it by reference (tighter than a CIDR)."
  type        = string
  default     = null
}

variable "operator_cidr_blocks" {
  description = "Extra CIDRs admitted to RDS on 5432 (VPN range, runner subnet). Empty admits none."
  type        = list(string)
  default     = []
}

# -- EKS ----------------------------------------------------------------------

variable "cluster_version" {
  description = <<-EOT
    Kubernetes version of the EKS control plane.

    Raise it by one minor at a time: EKS upgrades a single minor per
    operation, so a value two ahead of the running cluster fails the apply.
    Changing this is the upgrade - the apply moves the control plane, then
    rolls the managed node groups onto the matching AMI.
  EOT
  type        = string
  default     = "1.36"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDRs allowed to reach the public EKS API endpoint. Narrow this to the operator's egress addresses."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_type" {
  description = "Instance type of the general node group."
  type        = string
  default     = "t3.large"
}

variable "node_desired_size" {
  description = "Desired node count of the general node group."
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum node count of the general node group."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum node count of the general node group."
  type        = number
  default     = 4
}

# -- RDS ----------------------------------------------------------------------

variable "db_instance_class" {
  description = "Instance class of the operational PostgreSQL server."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB. Autoscaling may grow it to twice this."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL major version. 17 is what compose.yaml and the Flyway migrations assume."
  type        = string
  default     = "17"
}

variable "db_backup_retention_days" {
  description = "Automated backup retention, in days."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Multi-AZ standby. Set true for production."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Block `terraform destroy` on the database, and take a final snapshot. Set true for production."
  type        = bool
  default     = false
}
