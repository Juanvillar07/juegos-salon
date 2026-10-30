# Solo con dominio. Zona alojada: se crea o se usa la que Route 53 crea al registrar el dominio.
resource "aws_route53_zone" "this" {
  count = local.use_domain && var.create_hosted_zone ? 1 : 0
  name  = var.domain_name
}

data "aws_route53_zone" "this" {
  count        = local.use_domain && !var.create_hosted_zone ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

locals {
  zone_id = (
    !local.use_domain ? null
    : var.create_hosted_zone ? aws_route53_zone.this[0].zone_id
    : data.aws_route53_zone.this[0].zone_id
  )
}

# Frontend: dominio raíz y www apuntan a CloudFront (IPv4 e IPv6).
resource "aws_route53_record" "site" {
  for_each = !local.use_domain ? {} : {
    for pair in setproduct([local.site_domain, local.www_domain], ["A", "AAAA"]) :
    "${pair[0]}-${pair[1]}" => { name = pair[0], type = pair[1] }
  }

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

# Backend: api.<dominio> apunta a la IP estática de Lightsail. Caddy pide el certificado
# a Let's Encrypt en cuanto este registro resuelve.
# Con el backend apagado el registro se borra y el navegador no llega a ningún servidor.
resource "aws_route53_record" "api" {
  count   = local.use_domain && var.backend_enabled ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_domain
  type    = "A"
  ttl     = 300
  records = [local.static_ip]
}
