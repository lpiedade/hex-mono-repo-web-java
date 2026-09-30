# Optional VPC peering to the network Terraform is applied from.
#
# 02-platform runs `postgresql` resources against an RDS instance that has no
# public address. Same account and same region, so the request auto-accepts
# and no accepter resource is needed. Skipped entirely when operator_vpc_id is
# null - see variables.tf for the alternatives.

resource "aws_vpc_peering_connection" "operator" {
  count = local.operator_peering_enabled ? 1 : 0

  vpc_id      = module.vpc.vpc_id
  peer_vpc_id = var.operator_vpc_id
  auto_accept = true

  tags = merge(local.tags, { Name = "${local.name}-operator" })

  lifecycle {
    precondition {
      condition     = var.operator_vpc_cidr != null
      error_message = "operator_vpc_cidr is required when operator_vpc_id is set: it is the destination of the route added to this VPC's route tables."
    }
  }
}

# Outbound: this VPC's private subnets reach the operator VPC.
resource "aws_route" "to_operator" {
  count = local.operator_peering_enabled ? length(module.vpc.private_route_table_ids) : 0

  route_table_id            = module.vpc.private_route_table_ids[count.index]
  destination_cidr_block    = var.operator_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.operator[0].id
}

# Return path. When operator_route_table_ids is empty the route has to be added
# by hand on the operator side - the peering exists but carries no traffic
# until it is.
resource "aws_route" "from_operator" {
  count = local.operator_peering_enabled ? length(var.operator_route_table_ids) : 0

  route_table_id            = var.operator_route_table_ids[count.index]
  destination_cidr_block    = var.vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.operator[0].id
}
