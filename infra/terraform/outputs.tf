output "site_url" {
  description = "URL pública del Salón de Juegos."
  value       = local.site_url
}

output "api_url" {
  description = "URL del backend; es el VITE_SERVER_URL del cliente."
  value       = local.api_url
}

output "backend_enabled" {
  description = "Si el backend está encendido. deploy.yml lo lee para no encenderlo sin querer en un push."
  value       = var.backend_enabled
}

output "caddy_address" {
  description = "Dirección de sitio de Caddy en la instancia (la usa scripts/deploy-backend.sh)."
  value       = local.caddy_address
}

output "client_origins" {
  description = "Orígenes permitidos por CORS (CLIENT_ORIGIN del servidor)."
  value       = local.client_origins
}

output "static_ip" {
  description = "IP pública de la instancia de Lightsail (vacía con el backend apagado)."
  value       = local.static_ip == null ? "" : local.static_ip
}

output "lightsail_instance_name" {
  description = "Lo usa GitHub Actions para abrir el SSH a su IP mientras despliega."
  value       = join("", aws_lightsail_instance.api[*].name)
}

output "ssh_command" {
  value = local.static_ip == null ? "" : "ssh -i ~/.ssh/salon_deploy ubuntu@${local.static_ip}"
}

output "s3_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "name_servers" {
  description = "Solo si create_hosted_zone = true: configúralos en el registrador del dominio."
  value       = local.use_domain && var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : []
}
