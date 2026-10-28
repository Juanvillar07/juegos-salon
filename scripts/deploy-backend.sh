#!/usr/bin/env bash
# Copia el código del servidor a la instancia de Lightsail y (re)construye los contenedores
# (Node + Caddy). Requiere: terraform apply hecho y la clave SSH privada correspondiente.
#   ./scripts/deploy-backend.sh              # usa ~/.ssh/id_ed25519
#   SSH_KEY=~/.ssh/otra ./scripts/deploy-backend.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: no reescribir rutas remotas como /opt/salon

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tf() { terraform -chdir="$ROOT/infra/terraform" output -raw "$1"; }

HOST="$(tf static_ip)"
API_DOMAIN="$(tf api_domain)"
CLIENT_ORIGIN="$(tf client_origins)"
KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
remote() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$HOST" "$@"; }

echo "Esperando a que la instancia termine de prepararse (solo tarda en el primer arranque)…"
remote 'cloud-init status --wait >/dev/null; command -v docker >/dev/null'

echo "Enviando el código del servidor…"
tar -czf - -C "$ROOT" \
  --exclude='node_modules' --exclude='dist' \
  Dockerfile .dockerignore package.json package-lock.json tsconfig.base.json \
  shared server client/package.json deploy |
  remote 'rm -rf /opt/salon/app && mkdir -p /opt/salon/app && tar -xzf - -C /opt/salon/app'

echo "Construyendo y arrancando los contenedores…"
remote "printf 'API_DOMAIN=%s\nCLIENT_ORIGIN=%s\n' '$API_DOMAIN' '$CLIENT_ORIGIN' > /opt/salon/.env &&
  cd /opt/salon/app/deploy &&
  docker compose --env-file /opt/salon/.env up -d --build --remove-orphans &&
  docker image prune -f >/dev/null"

echo "Comprobando https://$API_DOMAIN/health (la primera vez Caddy tarda unos segundos en obtener el certificado)…"
curl --retry 20 --retry-delay 3 --retry-all-errors -fsS "https://$API_DOMAIN/health"
echo
echo "Backend desplegado en https://$API_DOMAIN"
