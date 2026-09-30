resource "aws_ecr_repository" "images" {
  for_each = local.ecr_repositories

  name = "${local.name}/${each.key}"

  # MUTABLE because build-and-push.sh publishes a moving `latest` alongside the
  # git-sha tag; 02-platform deploys the sha, so a rollback is a variable
  # change and never depends on `latest`.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # Lets `terraform destroy` remove a repository that still holds images.
  force_delete = true

  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "images" {
  for_each = aws_ecr_repository.images

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the 20 most recent images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = { type = "expire" }
      }
    ]
  })
}
