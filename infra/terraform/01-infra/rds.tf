# One PostgreSQL server holding the operational database.
#
# The database and the role the application connects with are created by
# 02-platform through the `postgresql` provider - this stack only brings up an
# empty server, so the application never connects as the master account.

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = module.vpc.private_subnets

  tags = local.tags
}

resource "aws_security_group" "database" {
  name        = "${local.name}-db"
  description = "PostgreSQL access for the EKS nodes and the operator network"
  vpc_id      = module.vpc.vpc_id

  tags = merge(local.tags, { Name = "${local.name}-db" })
}

# The pods connect from the node ENIs, so the node security group is the
# source. The EKS module exposes it as `node_security_group_id`.
resource "aws_vpc_security_group_ingress_rule" "database_from_nodes" {
  security_group_id = aws_security_group.database.id

  description                  = "PostgreSQL from the EKS nodes"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = module.eks.node_security_group_id
}

# 02-platform's `postgresql` provider. A security group can be referenced
# across a peering connection in the same region and account, which is tighter
# than opening the peer CIDR.
resource "aws_vpc_security_group_ingress_rule" "database_from_operator_sg" {
  count = var.operator_security_group_id != null ? 1 : 0

  security_group_id = aws_security_group.database.id

  description                  = "PostgreSQL from the operator instance"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = var.operator_security_group_id
}

# Fallback when only the peer CIDR is known.
resource "aws_vpc_security_group_ingress_rule" "database_from_operator_vpc" {
  count = var.operator_security_group_id == null && var.operator_vpc_cidr != null ? 1 : 0

  security_group_id = aws_security_group.database.id

  description = "PostgreSQL from the operator VPC"
  ip_protocol = "tcp"
  from_port   = 5432
  to_port     = 5432
  cidr_ipv4   = var.operator_vpc_cidr
}

resource "aws_vpc_security_group_ingress_rule" "database_from_operator_cidrs" {
  for_each = toset(var.operator_cidr_blocks)

  security_group_id = aws_security_group.database.id

  description = "PostgreSQL from an operator network"
  ip_protocol = "tcp"
  from_port   = 5432
  to_port     = 5432
  cidr_ipv4   = each.value
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-pg${var.db_engine_version}"
  family = "postgres${var.db_engine_version}"

  # Stated rather than inherited: the engine default scales with instance
  # memory and is small on the smallest classes. Each API replica opens one
  # Hikari pool.
  parameter {
    name         = "max_connections"
    value        = "200"
    apply_method = "pending-reboot"
  }

  tags = local.tags
}

resource "aws_db_instance" "main" {
  identifier = "${local.name}-pg"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  # No initial `db_name`: 02-platform creates the database together with its
  # owner. A db_name here would produce a database owned by the master
  # account.
  username = "postgres"
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period = var.db_backup_retention_days
  copy_tags_to_snapshot   = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = !var.db_deletion_protection
  final_snapshot_identifier = var.db_deletion_protection ? "${local.name}-pg-final" : null

  auto_minor_version_upgrade = true
  apply_immediately          = true

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = local.tags
}
