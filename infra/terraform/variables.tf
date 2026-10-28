variable "aws_region" {
  description = "Región de la instancia de Lightsail. us-east-1 suele ser la más barata y tiene buena latencia hacia Latinoamérica."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefijo para nombrar los recursos."
  type        = string
  default     = "salon-de-juegos"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "Solo minúsculas, números y guiones (3 a 30 caracteres)."
  }
}

variable "domain_name" {
  description = "Dominio del sitio, p. ej. salondejuegos.com. El frontend queda en el dominio y en www; el backend en api."
  type        = string
}

variable "api_subdomain" {
  description = "Subdominio del backend (Socket.IO)."
  type        = string
  default     = "api"
}

variable "create_hosted_zone" {
  description = <<-EOT
    false: el dominio está registrado en Route 53 y ya tiene su zona alojada (se busca).
    true: se crea la zona; después hay que poner sus servidores de nombres (output name_servers) en el registrador del dominio.
  EOT
  type        = bool
  default     = false
}

variable "availability_zone_suffix" {
  description = "Zona de disponibilidad de la instancia dentro de la región (a, b, c…)."
  type        = string
  default     = "a"
}

variable "lightsail_blueprint_id" {
  description = "Imagen de la instancia. Comprobar con: aws lightsail get-blueprints --query \"blueprints[?isActive && contains(blueprintId, 'ubuntu')].blueprintId\""
  type        = string
  default     = "ubuntu_24_04"
}

variable "lightsail_bundle_id" {
  description = "Plan de la instancia (1 GB de RAM por defecto). Comprobar con: aws lightsail get-bundles --query \"bundles[?isActive && ramSizeInGb<=`2`].[bundleId,price,ramSizeInGb]\""
  type        = string
  default     = "micro_3_0"
}

variable "ssh_public_key_path" {
  description = "Clave pública SSH para entrar a la instancia (la usa scripts/deploy-backend.sh)."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_allowed_cidrs" {
  description = "Redes que pueden entrar por SSH, p. ej. [\"203.0.113.10/32\"] (tu IP: curl https://checkip.amazonaws.com)."
  type        = list(string)

  validation {
    condition     = length(var.ssh_allowed_cidrs) > 0 && alltrue([for c in var.ssh_allowed_cidrs : can(cidrhost(c, 0))])
    error_message = "Indica al menos un bloque CIDR válido, p. ej. 203.0.113.10/32."
  }
}

variable "cloudfront_price_class" {
  description = "Ubicaciones de CloudFront. PriceClass_All incluye Sudamérica; la capa gratuita cubre el tráfico de un proyecto pequeño en cualquier clase."
  type        = string
  default     = "PriceClass_All"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "Debe ser PriceClass_All, PriceClass_200 o PriceClass_100."
  }
}

variable "budget_alert_email" {
  description = "Correo para la alerta de presupuesto mensual. Vacío = sin alerta."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Presupuesto mensual (USD) para la alerta."
  type        = number
  default     = 15
}
