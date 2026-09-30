output "state_bucket" {
  description = "Bucket holding the state of 01-infra and 02-platform. Also 02-platform's `state_bucket` variable."
  value       = aws_s3_bucket.state.id
}

output "backend_hcl" {
  description = "Contents for backend.hcl in 01-infra and 02-platform (`terraform init -backend-config=backend.hcl`)."
  value       = <<-EOT
    bucket = "${aws_s3_bucket.state.id}"
    region = "${var.region}"
  EOT
}
