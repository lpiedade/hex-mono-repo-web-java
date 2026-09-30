module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = "${local.name}-eks"
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Public API endpoint so the operator can run kubectl and 02-platform's
  # `kubernetes`/`helm` providers without a private-endpoint DNS arrangement.
  # Private access is on as well, which is what the in-cluster controllers
  # use. Narrow cluster_endpoint_public_access_cidrs.
  cluster_endpoint_public_access       = true
  cluster_endpoint_private_access      = true
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # The identity that runs `terraform apply` becomes a cluster admin through
  # an EKS access entry. Without it the operator who created the cluster can
  # reach the AWS API but not the Kubernetes API, and 02-platform fails on its
  # first `kubernetes_namespace`.
  enable_cluster_creator_admin_permissions = true

  enable_irsa = true

  cluster_addons = {
    coredns    = {}
    kube-proxy = {}
    vpc-cni    = { before_compute = true }
  }

  # `controllerManager` and `scheduler` are omitted: they bill per ingested GB
  # and are rarely read. Add them when you need them.
  cluster_enabled_log_types = ["api", "audit", "authenticator"]

  eks_managed_node_groups = {
    general = {
      instance_types = [var.node_instance_type]
      capacity_type  = "ON_DEMAND"
      ami_type       = "AL2023_x86_64_STANDARD"

      desired_size = var.node_desired_size
      min_size     = var.node_min_size
      max_size     = var.node_max_size

      labels = {
        workload = "general"
      }
    }
  }

  tags = local.tags
}
