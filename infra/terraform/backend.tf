# Una sola instancia: las salas viven en memoria, así que no se puede repartir entre varias
# sin antes mover el estado a Redis.

resource "aws_lightsail_key_pair" "deploy" {
  name       = "${var.project_name}-deploy"
  public_key = file(pathexpand(var.ssh_public_key_path))
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

resource "aws_lightsail_static_ip_attachment" "api" {
  static_ip_name = aws_lightsail_static_ip.api.name
  instance_name  = aws_lightsail_instance.api.name
}

# Firewall de la instancia: reemplaza las reglas por defecto (que abren SSH a todo internet).
resource "aws_lightsail_instance_public_ports" "api" {
  instance_name = aws_lightsail_instance.api.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }

  # HTTP solo para el desafío de Let's Encrypt y la redirección a HTTPS que hace Caddy.
  port_info {
    protocol   = "tcp"
    from_port  = 80
    to_port    = 80
    cidrs      = ["0.0.0.0/0"]
    ipv6_cidrs = ["::/0"]
  }

  port_info {
    protocol   = "tcp"
    from_port  = 443
    to_port    = 443
    cidrs      = ["0.0.0.0/0"]
    ipv6_cidrs = ["::/0"]
  }

  # HTTP/3 (QUIC).
  port_info {
    protocol   = "udp"
    from_port  = 443
    to_port    = 443
    cidrs      = ["0.0.0.0/0"]
    ipv6_cidrs = ["::/0"]
  }
}
