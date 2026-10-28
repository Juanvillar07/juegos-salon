#!/usr/bin/env bash
# Despliega el servidor en la instancia de Lightsail y (re)arranca los contenedores (Node + Caddy).
# Requiere: terraform apply hecho y la clave SSH privada de despliegue.
#   ./scripts/deploy-backend.sh                 # envía el código y la imagen se construye en la instancia
#   BUILD_LOCALLY=1 ./scripts/deploy-backend.sh # construye la imagen aquí (con Docker) y la envía ya hecha
#   SSH_KEY=~/.ssh/otra ./scripts/deploy-backend.sh
# GitHub Actions usa BUILD_LOCALLY=1: no carga la instancia de 1 GB con la compilación.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: no reescribir rutas remotas como /opt/salon

# En Git Bash, pwd -W da C:/…: terraform y docker son programas de Windows y no entienden /c/….
ROOT="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
tf() { terraform -chdir="$ROOT/infra/terraform" output -raw "$1"; }

HOST="$(tf static_ip)"
API_URL="$(tf api_url)"
SITE_ADDRESS="$(tf caddy_address)" # api.<dominio>, o :80 sin dominio (detrás de CloudFront)
CLIENT_ORIGIN="$(tf client_origins)"
KEY="${SSH_KEY:-$HOME/.ssh/salon_deploy}"
IMAGE="salon-server:latest" # el mismo nombre que en deploy/docker-compose.yml
remote() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ubuntu@$HOST" "$@"; }

echo "Conectando con $HOST…"
for attempt in $(seq 1 10); do
  remote true 2>/dev/null && break
  [ "$attempt" = 10 ] && { echo "No se pudo conectar por SSH a $HOST" >&2; exit 1; }
  sleep 5
done

echo "Esperando a que la instancia termine de prepararse (solo tarda en el primer arranque)…"
remote 'cloud-init status --wait >/dev/null; command -v docker >/dev/null'

if [ "${BUILD_LOCALLY:-0}" = 1 ]; then
  echo "Construyendo la imagen…"
  docker build --platform linux/amd64 -t "$IMAGE" "$ROOT"

  echo "Enviando la imagen y la configuración…"
  docker save "$IMAGE" | gzip | remote 'gunzip | docker load'
  tar -czf - -C "$ROOT" deploy |
    remote 'rm -rf /opt/salon/app && mkdir -p /opt/salon/app && tar -xzf - -C /opt/salon/app'
  BUILD_FLAG=--no-build
else
  echo "Enviando el código del servidor…"
  tar -czf - -C "$ROOT" \
    --exclude='node_modules' --exclude='dist' \
    Dockerfile .dockerignore package.json package-lock.json tsconfig.base.json \
    shared server client/package.json deploy |
    remote 'rm -rf /opt/salon/app && mkdir -p /opt/salon/app && tar -xzf - -C /opt/salon/app'
  BUILD_FLAG=--build
fi

echo "Arrancando los contenedores…"
remote "printf 'SITE_ADDRESS=%s\nCLIENT_ORIGIN=%s\n' '$SITE_ADDRESS' '$CLIENT_ORIGIN' > /opt/salon/.env &&
  cd /opt/salon/app/deploy &&
  docker compose --env-file /opt/salon/.env up -d $BUILD_FLAG --remove-orphans &&
  docker image prune -f >/dev/null"

echo "Comprobando $API_URL/health (con dominio, la primera vez Caddy tarda unos segundos en obtener el certificado)…"
curl --retry 20 --retry-delay 3 --retry-all-errors -fsS "$API_URL/health"
echo
echo "Backend desplegado en $API_URL"
