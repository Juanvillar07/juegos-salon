#!/bin/sh
# Primer arranque de la instancia de Lightsail (Ubuntu): deja la máquina lista para
# scripts/deploy-backend.sh. Se ejecuta una sola vez, como root.
# Lightsail antepone su propio script y lo ejecuta todo con sh (dash), no con la línea #!:
# solo sintaxis POSIX (sin pipefail ni bashismos).
set -eux
export DEBIAN_FRONTEND=noninteractive

# 1 GB de swap: construir la imagen de Node con 1 GB de RAM puede quedarse corto.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Docker y Compose desde los repositorios de Ubuntu (las actualizaciones de seguridad
# llegan con unattended-upgrades, activo por defecto).
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
usermod -aG docker ubuntu

# Logs de contenedores acotados para no llenar el disco.
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

mkdir -p /opt/salon
chown ubuntu:ubuntu /opt/salon
