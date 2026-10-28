output "site_url" {
  description = "URL pública del Salón de Juegos."
  value       = "https://${local.site_domain}"
}

output "api_url" {
  description = "URL del backend; es el VITE_SERVER_URL del cliente."
  value       = "https://${local.api_domain}"
}

output "api_domain" {
  value = local.api_domain
}

output "client_origins" {
  description = "Orígenes permitidos por CORS (CLIENT_ORIGIN del servidor)."
  value       = local.client_origins
}

output "static_ip" {
  description = "IP pública de la instancia de Lightsail."
  value       = aws_lightsail_static_ip.api.ip_address
}

output "ssh_command" {
  value = "ssh ubuntu@${aws_lightsail_static_ip.api.ip_address}"
}

output "s3_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "name_servers" {
  description = "Solo si create_hosted_zone = true: configúralos en el registrador del dominio."
  value       = var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : []
}
