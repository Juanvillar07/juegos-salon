data "aws_caller_identity" "current" {}

locals {
  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }

  site_domain = var.domain_name
  www_domain  = "www.${var.domain_name}"
  api_domain  = "${var.api_subdomain}.${var.domain_name}"

  # Orígenes permitidos por CORS en el backend (variable CLIENT_ORIGIN del servidor).
  client_origins = join(",", ["https://${local.site_domain}", "https://${local.www_domain}"])
}
