variable "aws_region" {
  description = "Región del bucket de estado; usa la misma que en infra/terraform."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "El mismo prefijo que en infra/terraform: los permisos se limitan a sus recursos."
  type        = string
  default     = "salon-de-juegos"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "Solo minúsculas, números y guiones (3 a 30 caracteres)."
  }
}

variable "github_repository" {
  description = "Repositorio de GitHub (propietario/nombre) cuyos workflows pueden asumir los roles."
  type        = string
  default     = "Juanvillar07/juegos-salon"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Formato propietario/nombre, p. ej. Juanvillar07/juegos-salon."
  }
}

variable "github_environment" {
  description = "Environment de GitHub de los jobs que despliegan. Solo ellos reciben permisos de escritura."
  type        = string
  default     = "production"
}

variable "create_github_oidc_provider" {
  description = "false si la cuenta ya tiene el proveedor OIDC de GitHub (solo puede haber uno por cuenta)."
  type        = bool
  default     = true
}
