output "backend_config" {
  description = "Contenido de infra/terraform/backend.hcl."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.tfstate.bucket}"
    key          = "${local.state_key}"
    region       = "${var.aws_region}"
    encrypt      = true
    use_lockfile = true
  EOT
}

output "github_variables" {
  description = "Variables del repositorio en GitHub (Settings → Secrets and variables → Actions → Variables)."
  value = {
    AWS_REGION          = var.aws_region
    AWS_PLAN_ROLE_ARN   = aws_iam_role.plan.arn
    AWS_DEPLOY_ROLE_ARN = aws_iam_role.deploy.arn
    TF_STATE_BUCKET     = aws_s3_bucket.tfstate.bucket
    TF_STATE_KEY        = local.state_key
  }
}
