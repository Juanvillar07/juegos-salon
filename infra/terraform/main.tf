data "aws_caller_identity" "current" {}

locals {
  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }

  # Sin dominio, todo cuelga de la URL de CloudFront (ver frontend.tf).
  use_domain = var.domain_name != ""

  site_domain = var.domain_name
  www_domain  = "www.${var.domain_name}"
  api_domain  = "${var.api_subdomain}.${var.domain_name}"

  # Sin dominio, CloudFront llega a la instancia por un nombre de sslip.io que resuelve a su IP
  # (1-2-3-4.sslip.io → 1.2.3.4): CloudFront no acepta IPs como origen y Lightsail no da nombre DNS.
  # Con el backend apagado no hay IP: CloudFront se queda sin el origen de la API (ver frontend.tf).
  static_ip         = one(aws_lightsail_static_ip.api[*].ip_address)
  api_origin_domain = local.static_ip == null ? null : "${replace(local.static_ip, ".", "-")}.sslip.io"
  # CloudFront solo lleva la API a la instancia sin dominio y con el backend encendido.
  api_via_cloudfront = !local.use_domain && var.backend_enabled

  site_url = local.use_domain ? "https://${local.site_domain}" : "https://${aws_cloudfront_distribution.web.domain_name}"
  # Sin dominio, el cliente y la API comparten origen.
  api_url = local.use_domain ? "https://${local.api_domain}" : local.site_url

  # Orígenes permitidos por CORS en el backend (variable CLIENT_ORIGIN del servidor).
  client_origins = local.use_domain ? join(",", ["https://${local.site_domain}", "https://${local.www_domain}"]) : local.site_url

  # Dirección de sitio de Caddy: con dominio, HTTPS automático para api.<dominio>;
  # sin dominio, HTTP en el puerto 80 (CloudFront pone el HTTPS delante).
  caddy_address = local.use_domain ? local.api_domain : ":80"
}
