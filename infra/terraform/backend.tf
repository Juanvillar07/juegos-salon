# Una sola instancia: las salas viven en memoria, así que no se puede repartir entre varias
# sin antes mover el estado a Redis.

resource "aws_lightsail_key_pair" "deploy" {
  name       = "${var.project_name}-deploy"
  public_key = var.ssh_public_key
}

resource "aws_lightsail_instance" "api" {
  name              = "${var.project_name}-api"
  availability_zone = "${var.aws_region}${var.availability_zone_suffix}"
  blueprint_id      = var.lightsail_blueprint_id
  bundle_id         = var.lightsail_bundle_id
  key_pair_name     = aws_lightsail_key_pair.deploy.name

  # Solo prepara la máquina (Docker, swap). La app la despliega scripts/deploy-backend.sh,
  # así cambiar de dominio o de código no obliga a recrear la instancia.
  user_data = file("${path.module}/templates/user_data.sh")
}

resource "aws_lightsail_static_ip" "api" {
  name = "${var.project_name}-api-ip"
}

# La IP y el firewall se recrean junto con la instancia: al reemplazarla, el nombre no cambia
# y Terraform no vería que la nueva nace sin IP estática y con el firewall por defecto.
resource "aws_lightsail_static_ip_attachment" "api" {
  static_ip_name = aws_lightsail_static_ip.api.name
  instance_name  = aws_lightsail_instance.api.name

  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.api.id]
  }
}

# Firewall de la instancia: reemplaza las reglas por defecto (que abren SSH a todo internet).
resource "aws_lightsail_instance_public_ports" "api" {
  instance_name = aws_lightsail_instance.api.name

  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.api.id]
  }

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }

  # Con dominio: desafío de Let's Encrypt y redirección a HTTPS que hace Caddy.
  # Sin dominio: el tráfico de la API que llega desde CloudFront.
  port_info {
    protocol   = "tcp"
    from_port  = 80
    to_port    = 80
    cidrs      = ["0.0.0.0/0"]
    ipv6_cidrs = ["::/0"]
  }

  # HTTPS y HTTP/3 (QUIC), solo con dominio: sin él, Caddy atiende a CloudFront por el puerto 80.
  dynamic "port_info" {
    for_each = local.use_domain ? ["tcp", "udp"] : []
    content {
      protocol   = port_info.value
      from_port  = 443
      to_port    = 443
      cidrs      = ["0.0.0.0/0"]
      ipv6_cidrs = ["::/0"]
    }
  }
}
